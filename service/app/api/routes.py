"""REST + WebSocket 엔드포인트. 계약은 docs/api/generation.md 에 정의한다.

생성 요청에는 항상 프로젝트 컨텍스트 스냅샷(트랙·클립·BPM·키)이 포함된다 — AI DAW의 전제.
mock 생성기 단계: 생성 계약 전체가 동작한다. /analyze 는 계약 미정의로 501 유지.
None 필드는 wire 에서 생략한다 — response_model_exclude_none=True, WS 는 schemas.to_wire().
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from app.api import jobs  # 속성 접근으로 참조 — 테스트에서 job_manager 교체 가능해야 한다
from app.api.jobs import TERMINAL, JobRecord
from app.api.schemas import (
    CancelResponse,
    GenerateJob,
    GenerateRequest,
    JobCancelledMessage,
    JobFailedMessage,
    JobProgressMessage,
    JobSucceededMessage,
    JobWsMessage,
    to_wire,
)

router = APIRouter()


def _require(job_id: str) -> JobRecord:
    job = jobs.job_manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="존재하지 않는 job")
    return job


@router.post(
    "/generate", response_model=GenerateJob, status_code=202, response_model_exclude_none=True
)
async def generate(req: GenerateRequest) -> GenerateJob:
    """생성 작업 등록. 202 + job 반환, 진행률은 WS /ws/jobs/{job_id} 스트리밍."""
    if jobs.job_manager.busy:
        raise HTTPException(
            status_code=409,
            detail={"code": "SERVICE_BUSY", "message": "다른 생성 작업이 진행 중입니다"},
        )
    return jobs.job_manager.start(req).snapshot()


@router.get("/jobs/{job_id}", response_model=GenerateJob, response_model_exclude_none=True)
async def get_job(job_id: str) -> GenerateJob:
    """job 상태 스냅샷 — WS 단절 후 복구용."""
    return _require(job_id).snapshot()


@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str) -> FileResponse:
    """생성 결과 바이트 (audio/wav 또는 audio/midi). succeeded 상태에서만 200."""
    job = _require(job_id)
    if job.status != "succeeded":
        raise HTTPException(status_code=409, detail=f"job이 succeeded 상태가 아닙니다: {job.status}")
    media = "audio/wav" if job.request.output.kind == "audio" else "audio/midi"
    return FileResponse(job.result_path, media_type=media)


@router.post(
    "/jobs/{job_id}/cancel",
    response_model=CancelResponse,
    status_code=202,
    response_model_exclude_none=True,
)
async def cancel_job(job_id: str) -> CancelResponse:
    """생성 취소. 멱등 — 이미 종료된 job이면 already_finished."""
    return jobs.job_manager.cancel(_require(job_id))


@router.websocket("/ws/jobs/{job_id}")
async def job_ws(ws: WebSocket, job_id: str) -> None:
    """접속 즉시 현재 상태 1회 송신 후 이벤트 스트림. 종료 메시지 송신 후 서버가 닫는다.

    유실 창 없음: 구독 등록 → 스냅샷 송신 준비 사이에 await 가 없어(asyncio 는 await
    지점에서만 선점) 등록 이후 종료 이벤트는 큐로, 이전 종료는 스냅샷으로 반드시 전달된다.
    """
    await ws.accept()
    job = jobs.job_manager.get(job_id)
    if job is None:
        await ws.close(code=4404)
        return
    queue = jobs.job_manager.subscribe(job)
    first = _snapshot_message(job)
    try:
        await ws.send_text(to_wire(first))
        if job.status in TERMINAL:  # 늦은 접속 — 종료 메시지 보장 후 닫음
            await ws.close()
            return
        while True:
            msg = await queue.get()
            await ws.send_text(to_wire(msg))
            if msg.type != "progress":
                await ws.close()
                return
    except (WebSocketDisconnect, OSError):
        # WS 단절 ≠ 취소 (계약 — 취소는 POST /cancel 만).
        # uvicorn 은 끊긴 소켓 send 시 WebSocketDisconnect 가 아니라 ClientDisconnected(OSError)를 던진다.
        pass
    finally:
        jobs.job_manager.unsubscribe(job, queue)


def _snapshot_message(job: JobRecord) -> JobWsMessage:
    if job.status == "succeeded" and job.result is not None:
        return JobSucceededMessage(job_id=job.job_id, result=job.result)
    if job.status == "failed" and job.error is not None:
        return JobFailedMessage(job_id=job.job_id, error=job.error)
    if job.status == "cancelled":
        return JobCancelledMessage(job_id=job.job_id)
    return JobProgressMessage(job_id=job.job_id, progress=job.progress, stage=job.stage or "queued")


@router.post("/analyze")
def analyze() -> None:
    """사용자 녹음 루프 분석(BPM·키·온셋). 계약 미정의 — 사용 시점에 정의한다."""
    raise HTTPException(status_code=501, detail="미구현")
