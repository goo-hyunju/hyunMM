"""renderer↔service wire 계약 스키마 (JSON은 camelCase).

변경 시 renderer/src/app/types/{project,serviceContract}.ts 와
docs/api/{project-schema,generation}.md 를 같은 커밋에서 갱신한다.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ContractModel(BaseModel):
    """모든 계약 모델의 베이스 — wire 포맷은 camelCase, 미정의 필드는 거부.

    serialize_by_alias 는 pydantic 2.11+ (pyproject 핀과 함께 움직인다).
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
    )


def to_wire(model: BaseModel) -> str:
    """WS 등 response_model 을 거치지 않는 직렬화는 반드시 이 헬퍼를 쓴다.

    계약 규칙: None 필드는 wire 에서 null 이 아니라 **생략**된다 (TS optional 과 일치).
    REST 는 라우트의 response_model_exclude_none=True 가 같은 역할을 한다.
    """
    return model.model_dump_json(exclude_none=True)


# ---- project.json 부분집합 (컨텍스트 스냅샷) ----

PitchClass = Literal["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
TrackKind = Literal["audio", "midi"]


class MusicalKey(ContractModel):
    tonic: PitchClass
    mode: Literal["major", "minor"]


class TimeSignature(ContractModel):
    numerator: int = Field(gt=0)
    denominator: Literal[1, 2, 4, 8, 16]


class Track(ContractModel):
    id: str
    name: str
    kind: TrackKind
    volume: float = Field(ge=0, le=2)  # linear gain, 1 = unity
    pan: float = Field(ge=-1, le=1)
    mute: bool
    solo: bool


class ClipOrigin(ContractModel):
    source: Literal["user", "ai"]
    job_id: str | None = None
    prompt: str | None = None


class AudioClipMedia(ContractModel):
    kind: Literal["audio"] = "audio"
    path: str  # 프로젝트 폴더 기준 상대경로
    duration_sec: float = Field(gt=0)


class MidiClipMedia(ContractModel):
    kind: Literal["midi"] = "midi"
    path: str


ClipMedia = Annotated[AudioClipMedia | MidiClipMedia, Field(discriminator="kind")]


class Clip(ContractModel):
    id: str
    track_id: str
    name: str
    start_beat: float = Field(ge=0)
    length_beats: float = Field(gt=0)
    media: ClipMedia
    origin: ClipOrigin


class ProjectContextSnapshot(ContractModel):
    """생성 요청에 항상 포함 — AI DAW의 전제. v1은 메타데이터만, 프로젝트 경로 없음.

    모든 필드 required (TS 와 대칭) — 빈 프로젝트는 tracks/clips 빈 배열로 표현한다.
    """

    bpm: float = Field(gt=0)
    time_signature: TimeSignature
    key: MusicalKey | None  # 명시적 null 허용, 생략 불가
    tracks: list[Track]
    clips: list[Clip]


# ---- 생성 요청 / job ----

OutputKind = Literal["audio", "midi"]
JobStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]
GenerationStage = Literal["queued", "loading_model", "generating", "encoding"]
ServiceErrorCode = Literal[
    "SERVICE_BUSY", "MODEL_NOT_LOADED", "INVALID_CONTEXT", "GENERATION_FAILED"
]


class GenerateOutputSpec(ContractModel):
    kind: OutputKind  # music_generator / midi_generator 라우팅 키
    length_beats: float = Field(gt=0)


class GenerateRequest(ContractModel):
    prompt: str = Field(min_length=1, max_length=2000)
    output: GenerateOutputSpec
    target_track_id: str | None  # None = 새 트랙 제안. 명시적 null 허용, 생략 불가
    context: ProjectContextSnapshot


class ServiceError(ContractModel):
    code: ServiceErrorCode
    message: str


class AudioResult(ContractModel):
    kind: Literal["audio"] = "audio"
    duration_sec: float = Field(gt=0)
    suggested_length_beats: float = Field(gt=0)


class MidiResult(ContractModel):
    kind: Literal["midi"] = "midi"
    length_beats: float = Field(gt=0)


GenerateResult = Annotated[AudioResult | MidiResult, Field(discriminator="kind")]


class GenerateJob(ContractModel):
    """GET /jobs/{job_id} 상태 스냅샷 — WS 단절 후 복구용."""

    job_id: str
    status: JobStatus
    progress: float | None = Field(default=None, ge=0, le=1)  # None = indeterminate
    stage: GenerationStage | None = None
    result: GenerateResult | None = None  # succeeded일 때만
    error: ServiceError | None = None  # failed일 때만


class CancelResponse(ContractModel):
    job_id: str
    status: Literal["cancelling", "already_finished"]  # 멱등 — 종료된 job이면 no-op


# ---- WS /ws/jobs/{job_id} 메시지 ----


class JobProgressMessage(ContractModel):
    type: Literal["progress"] = "progress"
    job_id: str
    progress: float | None = Field(default=None, ge=0, le=1)
    stage: GenerationStage


class JobSucceededMessage(ContractModel):
    type: Literal["succeeded"] = "succeeded"
    job_id: str
    result: GenerateResult


class JobFailedMessage(ContractModel):
    type: Literal["failed"] = "failed"
    job_id: str
    error: ServiceError


class JobCancelledMessage(ContractModel):
    type: Literal["cancelled"] = "cancelled"
    job_id: str


JobWsMessage = Annotated[
    JobProgressMessage | JobSucceededMessage | JobFailedMessage | JobCancelledMessage,
    Field(discriminator="type"),
]
