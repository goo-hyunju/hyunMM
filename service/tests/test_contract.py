"""계약 스키마 검증 — wire 포맷(camelCase)과 라우트 배선을 잠근다."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from app.api.schemas import GenerateJob, GenerateRequest, JobProgressMessage, JobWsMessage, to_wire
from app.main import app

VALID_REQUEST = {
    "prompt": "어두운 808 베이스라인",
    "output": {"kind": "midi", "lengthBeats": 16},
    "targetTrackId": "trk_d4e5f6",
    "context": {
        "bpm": 120,
        "timeSignature": {"numerator": 4, "denominator": 4},
        "key": {"tonic": "C", "mode": "minor"},
        "tracks": [
            {
                "id": "trk_a1b2c3",
                "name": "Drums",
                "kind": "audio",
                "volume": 1.0,
                "pan": 0,
                "mute": False,
                "solo": False,
            }
        ],
        "clips": [
            {
                "id": "clp_x1y2z3",
                "trackId": "trk_a1b2c3",
                "name": "drum loop 1",
                "startBeat": 0,
                "lengthBeats": 16,
                "media": {"kind": "audio", "path": "audio/clp_x1y2z3.wav", "durationSec": 8.0},
                "origin": {"source": "user"},
            }
        ],
    },
}


def test_generate_request_camel_round_trip():
    req = GenerateRequest.model_validate(VALID_REQUEST)
    assert req.output.length_beats == 16
    assert req.context.clips[0].start_beat == 0

    dumped = req.model_dump(mode="json", exclude_none=True)
    assert dumped == VALID_REQUEST  # wire 키는 camelCase 그대로 (serialize_by_alias)


def test_ws_message_discriminated_union():
    msg = TypeAdapter(JobWsMessage).validate_python(
        {"type": "progress", "jobId": "job_1", "progress": 0.42, "stage": "generating"}
    )
    assert isinstance(msg, JobProgressMessage)
    assert '"jobId"' in msg.model_dump_json()  # WS 직렬화도 camelCase

    with pytest.raises(ValidationError):
        TypeAdapter(JobWsMessage).validate_python({"type": "unknown", "jobId": "job_1"})


def test_none_fields_omitted_on_wire():
    """계약 규칙: None 필드는 null이 아니라 생략된다 (TS optional과 일치)."""
    job = GenerateJob(job_id="job_1", status="queued")
    wire = json.loads(to_wire(job))
    assert wire == {"jobId": "job_1", "status": "queued"}  # progress/stage/result/error 키 자체가 없음

    # REST 경로도 동일 규칙 — 라우트에 response_model_exclude_none=True 가 걸려 있는지 잠근다
    # (app.routes 는 starlette 버전에 따라 router 가 중첩 노출되므로 원본 router 에서 검사)
    from app.api.routes import router

    routes = {r.path: r for r in router.routes if hasattr(r, "response_model_exclude_none")}
    for path in ("/generate", "/jobs/{job_id}", "/jobs/{job_id}/cancel"):
        assert routes[path].response_model_exclude_none is True


def test_extra_field_forbidden():
    bad = {**VALID_REQUEST, "promt": "오타 필드"}
    with pytest.raises(ValidationError):
        GenerateRequest.model_validate(bad)


def test_routes_wired_to_schemas():
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        # 불량 payload는 라우트 도달 전 422 — 스키마가 실제로 물려 있다
        assert client.post("/generate", json={"prompt": ""}).status_code == 422
        # 미존재 job 은 404 (유효 payload 왕복은 test_generation_flow.py 담당)
        assert client.get("/jobs/job_missing").status_code == 404
        assert client.get("/jobs/job_missing/result").status_code == 404
        assert client.post("/jobs/job_missing/cancel").status_code == 404
        # analyze 는 계약 미정의 — 501 스텁 유지
        assert client.post("/analyze").status_code == 501
