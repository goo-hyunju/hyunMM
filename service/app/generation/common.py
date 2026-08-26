"""생성기 공통 — 진행률 콜백 타입, 음이름 매핑, mock 파라미터."""

from collections.abc import Callable

from app.api.schemas import GenerationStage

# (progress 0~1 또는 None=indeterminate, stage)
ProgressFn = Callable[[float | None, GenerationStage], None]

PITCH_TO_SEMITONE: dict[str, int] = {
    "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5,
    "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11,
}

# lengthBeats에 계약상 상한이 없어 mock 폭주 방지용으로 clamp 한다
MAX_MOCK_BEATS = 64
