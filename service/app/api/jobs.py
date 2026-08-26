"""생성 job 라이프사이클 — in-memory 저장소 + asyncio 실행 + WS 구독 발행.

wire 타입만 다루고 AI 의미론은 없다. 실모델 단계에서 _run 의 생성기 라우팅을
app/agent/ 로 이관한다. _jobs/staging 은 무한 누적 — 정리 정책은 계약 TODO.
"""

import asyncio
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from app.api import schemas as s
from app.generation.midi_generator import MidiGenerator
from app.generation.music_generator import MusicGenerator

STAGING_DIR = Path(__file__).resolve().parents[2] / "staging"  # service/staging (gitignored)
TERMINAL = frozenset({"succeeded", "failed", "cancelled"})


@dataclass
class JobRecord:
    job_id: str
    request: s.GenerateRequest
    status: s.JobStatus = "queued"
    progress: float | None = None
    stage: s.GenerationStage | None = "queued"
    result: s.GenerateResult | None = None
    error: s.ServiceError | None = None
    task: "asyncio.Task[None] | None" = None
    cancelled_flag: asyncio.Event = field(default_factory=asyncio.Event)
    subscribers: "list[asyncio.Queue[s.JobWsMessage]]" = field(default_factory=list)

    @property
    def result_path(self) -> Path:
        ext = "wav" if self.request.output.kind == "audio" else "mid"
        return STAGING_DIR / f"{self.job_id}.{ext}"

    def snapshot(self) -> s.GenerateJob:
        return s.GenerateJob(
            job_id=self.job_id,
            status=self.status,
            progress=self.progress,
            stage=self.stage,
            result=self.result,
            error=self.error,
        )


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, JobRecord] = {}
        self._active_id: str | None = None

    def get(self, job_id: str) -> JobRecord | None:
        return self._jobs.get(job_id)

    @property
    def busy(self) -> bool:
        return self._active_id is not None

    def start(self, req: s.GenerateRequest) -> JobRecord:
        # 호출부(라우트)의 busy 체크 ~ 여기까지 await 없음 → 단일 이벤트 루프에서 원자적
        job = JobRecord(job_id=f"job_{uuid.uuid4().hex[:12]}", request=req)
        self._jobs[job.job_id] = job
        self._active_id = job.job_id
        job.task = asyncio.create_task(self._run(job))
        # _run 본문 진입 전 cancel 되면 내부 finally 가 실행되지 않는다 — done 콜백으로 이중 방어.
        # 실모델(executor 스레드) 단계에서 이 경계가 실제 위험이 된다.
        job.task.add_done_callback(lambda _t: self._finalize(job))
        return job

    def _finalize(self, job: JobRecord) -> None:
        if self._active_id == job.job_id:
            self._active_id = None
        if job.status not in TERMINAL:
            job.status = "cancelled"
            self._publish(job, s.JobCancelledMessage(job_id=job.job_id))

    def cancel(self, job: JobRecord) -> s.CancelResponse:
        if job.status in TERMINAL:  # 멱등 — 종료 상태는 최종 (계약)
            return s.CancelResponse(job_id=job.job_id, status="already_finished")
        job.cancelled_flag.set()  # 협조적 플래그 — 실모델(executor 스레드) 대비 계약
        if job.task is not None:
            job.task.cancel()  # mock 의 주 취소 경로 (asyncio.sleep 즉시 중단)
        return s.CancelResponse(job_id=job.job_id, status="cancelling")

    def subscribe(self, job: JobRecord) -> "asyncio.Queue[s.JobWsMessage]":
        q: asyncio.Queue[s.JobWsMessage] = asyncio.Queue()
        job.subscribers.append(q)
        return q

    def unsubscribe(self, job: JobRecord, q: "asyncio.Queue[s.JobWsMessage]") -> None:
        if q in job.subscribers:
            job.subscribers.remove(q)

    def _publish(self, job: JobRecord, msg: s.JobWsMessage) -> None:
        for q in job.subscribers:
            q.put_nowait(msg)  # 무한 큐 — sync 컨텍스트에서 안전

    def _on_progress(self, job: JobRecord, progress: float | None, stage: s.GenerationStage) -> None:
        job.progress, job.stage = progress, stage
        self._publish(job, s.JobProgressMessage(job_id=job.job_id, progress=progress, stage=stage))

    async def _run(self, job: JobRecord) -> None:
        req = job.request
        try:
            job.status = "running"

            def cb(p: float | None, st: s.GenerationStage) -> None:
                self._on_progress(job, p, st)

            gen = MusicGenerator() if req.output.kind == "audio" else MidiGenerator()
            data, result = await gen.generate(
                req.prompt,
                req.context,
                req.output.length_beats,
                on_progress=cb,
                cancelled=job.cancelled_flag,
            )
            STAGING_DIR.mkdir(parents=True, exist_ok=True)
            job.result_path.write_bytes(data)
            job.status, job.result, job.progress = "succeeded", result, 1.0
            self._publish(job, s.JobSucceededMessage(job_id=job.job_id, result=result))
        except asyncio.CancelledError:
            job.status = "cancelled"
            self._publish(job, s.JobCancelledMessage(job_id=job.job_id))
            # 최상위 task 이므로 재-raise 하지 않는다 (서버 shutdown cancel 도 무해)
        except Exception as exc:  # 실패는 계약의 failed 경로로 정규화
            job.status = "failed"
            job.error = s.ServiceError(code="GENERATION_FAILED", message=str(exc))
            self._publish(job, s.JobFailedMessage(job_id=job.job_id, error=job.error))
        finally:
            self._active_id = None


job_manager = JobManager()
