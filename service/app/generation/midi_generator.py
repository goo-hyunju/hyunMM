"""MIDI 패턴 mock 생성기 — SMF format 0 바이트를 직접 작성 (pretty_midi 불필요)."""

import asyncio
import math

from app.api.schemas import MidiResult, ProjectContextSnapshot
from app.generation.common import MAX_MOCK_BEATS, PITCH_TO_SEMITONE, ProgressFn

TPQN = 480  # ticks per quarter note
STEP_DELAY_SEC = 0.25  # beat당 시뮬레이션 지연 — 테스트가 monkeypatch 한다


def _vlq(n: int) -> bytes:
    """SMF variable-length quantity."""
    out = bytearray([n & 0x7F])
    n >>= 7
    while n:
        out.insert(0, 0x80 | (n & 0x7F))
        n >>= 7
    return bytes(out)


class MidiGenerator:
    async def generate(
        self,
        prompt: str,
        context: ProjectContextSnapshot,
        length_beats: float,
        *,
        on_progress: ProgressFn,
        cancelled: asyncio.Event,
    ) -> tuple[bytes, MidiResult]:
        del prompt  # mock 은 프롬프트를 해석하지 않는다
        on_progress(0.0, "loading_model")
        await asyncio.sleep(STEP_DELAY_SEC)

        root = 36 + (PITCH_TO_SEMITONE[context.key.tonic] if context.key else 0)
        beats = max(1, min(math.ceil(length_beats), MAX_MOCK_BEATS))

        # tempo 메타 이벤트로 컨텍스트 bpm 반영
        track = bytearray(b"\x00\xff\x51\x03" + round(60_000_000 / context.bpm).to_bytes(3, "big"))
        pending = 0
        for b in range(beats):
            if cancelled.is_set():
                raise asyncio.CancelledError
            note = root if b % 4 in (0, 2) else root + 7  # 단순 4비트: root/5도 교대
            track += _vlq(pending) + bytes((0x90, note, 100))
            track += _vlq(TPQN // 2) + bytes((0x80, note, 0))  # 게이트 = 반 박
            pending = TPQN - TPQN // 2
            on_progress(0.1 + 0.8 * (b + 1) / beats, "generating")
            await asyncio.sleep(STEP_DELAY_SEC)

        on_progress(0.95, "encoding")
        track += _vlq(pending) + b"\xff\x2f\x00"  # End of Track
        header = (
            b"MThd"
            + (6).to_bytes(4, "big")
            + (0).to_bytes(2, "big")  # format 0
            + (1).to_bytes(2, "big")  # 트랙 1개
            + TPQN.to_bytes(2, "big")
        )
        data = header + b"MTrk" + len(track).to_bytes(4, "big") + bytes(track)
        return data, MidiResult(length_beats=float(beats))
