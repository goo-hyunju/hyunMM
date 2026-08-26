"""mock 생성 왕복 — job 라이프사이클·WS 순서·취소 멱등·busy·result 바이트 검증.

TestClient 는 반드시 컨텍스트 매니저로 쓴다 — 단일 portal(이벤트 루프)이 유지되어야
asyncio.create_task 로 띄운 백그라운드 job 이 진행된다.
"""

import io
import time
import wave

import pytest
from fastapi.testclient import TestClient

from app.api import jobs as jobs_mod
from app.generation import midi_generator, music_generator
from app.main import app
from tests.test_contract import VALID_REQUEST


def _request(kind: str, length_beats: float = 4) -> dict:
    return {
        **VALID_REQUEST,
        "output": {"kind": kind, "lengthBeats": length_beats},
    }


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(jobs_mod, "STAGING_DIR", tmp_path)  # staging 오염 방지
    monkeypatch.setattr(music_generator, "STEP_DELAY_SEC", 0.01)  # 테스트 가속
    monkeypatch.setattr(midi_generator, "STEP_DELAY_SEC", 0.01)
    monkeypatch.setattr(jobs_mod, "job_manager", jobs_mod.JobManager())  # 테스트 간 격리
    with TestClient(app) as c:
        yield c


def _wait_terminal(client: TestClient, job_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/jobs/{job_id}").json()
        if body["status"] in ("succeeded", "failed", "cancelled"):
            return body
        time.sleep(0.02)
    pytest.fail("job이 제한시간 안에 종료되지 않음")


def test_midi_round_trip(client):
    res = client.post("/generate", json=_request("midi", 16))
    assert res.status_code == 202
    job_id = res.json()["jobId"]
    assert job_id.startswith("job_")

    final = _wait_terminal(client, job_id)
    assert final["status"] == "succeeded"
    assert final["result"] == {"kind": "midi", "lengthBeats": 16.0}

    result = client.get(f"/jobs/{job_id}/result")
    assert result.status_code == 200
    assert result.headers["content-type"].startswith("audio/midi")
    assert result.content.startswith(b"MThd\x00\x00\x00\x06\x00\x00")  # SMF format 0
    assert b"MTrk" in result.content


def test_audio_round_trip_with_ws(client):
    res = client.post("/generate", json=_request("audio", 4))
    assert res.status_code == 202
    job_id = res.json()["jobId"]

    messages = []
    with client.websocket_connect(f"/ws/jobs/{job_id}") as ws:
        while True:
            msg = ws.receive_json()
            assert msg["jobId"] == job_id
            messages.append(msg)
            if msg["type"] != "progress":
                break
    assert messages[-1]["type"] == "succeeded"
    assert all(m["type"] == "progress" for m in messages[:-1])
    # 계약 보장은 "접속 시점 현재 상태 + 이후 스트림" — 접속 전 지나간 stage 수신은 보장 없음
    stages = {m["stage"] for m in messages if m["type"] == "progress"}
    assert stages <= {"queued", "loading_model", "generating", "encoding"}
    progresses = [m["progress"] for m in messages if m["type"] == "progress" and "progress" in m]
    assert progresses == sorted(progresses)  # 진행률 단조 증가

    result = client.get(f"/jobs/{job_id}/result")
    assert result.status_code == 200
    assert result.headers["content-type"].startswith("audio/wav")
    with wave.open(io.BytesIO(result.content)) as w:
        assert w.getsampwidth() == 2  # 16bit PCM (계약)
        expected_frames = int(4 * 60 / 120 * 44100)  # 4 beats @120bpm — bpm 반영 확인
        assert abs(w.getnframes() - expected_frames) <= 4


def test_cancel_idempotent_and_busy_release(client, monkeypatch):
    monkeypatch.setattr(music_generator, "STEP_DELAY_SEC", 0.2)  # 취소 창 확보
    job_id = client.post("/generate", json=_request("audio", 16)).json()["jobId"]

    cancel = client.post(f"/jobs/{job_id}/cancel")
    assert cancel.status_code == 202
    assert cancel.json() == {"jobId": job_id, "status": "cancelling"}

    final = _wait_terminal(client, job_id)
    assert final["status"] == "cancelled"

    again = client.post(f"/jobs/{job_id}/cancel")
    assert again.json()["status"] == "already_finished"  # 멱등

    assert client.get(f"/jobs/{job_id}/result").status_code == 409  # 결과 없음

    monkeypatch.setattr(music_generator, "STEP_DELAY_SEC", 0.01)
    retry = client.post("/generate", json=_request("audio", 2))  # busy 해제 확인
    assert retry.status_code == 202
    _wait_terminal(client, retry.json()["jobId"])


def test_service_busy(client, monkeypatch):
    monkeypatch.setattr(music_generator, "STEP_DELAY_SEC", 0.2)
    first = client.post("/generate", json=_request("audio", 16))
    assert first.status_code == 202

    second = client.post("/generate", json=_request("audio", 2))
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "SERVICE_BUSY"  # detail 봉투 (계약)

    client.post(f"/jobs/{first.json()['jobId']}/cancel")
    _wait_terminal(client, first.json()["jobId"])


def test_late_ws_connect_gets_terminal_message(client):
    job_id = client.post("/generate", json=_request("midi", 2)).json()["jobId"]
    _wait_terminal(client, job_id)

    with client.websocket_connect(f"/ws/jobs/{job_id}") as ws:
        first = ws.receive_json()
    assert first["type"] == "succeeded"  # 늦은 접속도 종료 메시지 보장
