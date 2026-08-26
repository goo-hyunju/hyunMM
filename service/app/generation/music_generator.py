"""오디오 스템 mock 생성기 — stdlib 합성 톤 WAV.

실모델(MusicGen 계열, 라이선스 확인 후)로 교체될 때도 generate() 시그니처는 유지한다.
cancelled 는 실모델의 협조적 취소용 계약 — mock 은 task.cancel 로도 끊기지만
체크포인트를 두어 동일한 취소 의미론을 갖는다.
"""

import asyncio
import io
import math
import wave
from array import array

from app.api.schemas import AudioResult, ProjectContextSnapshot
from app.generation.common import MAX_MOCK_BEATS, PITCH_TO_SEMITONE, ProgressFn

SAMPLE_RATE = 44100
STEP_DELAY_SEC = 0.25  # beat당 시뮬레이션 지연 — 테스트가 monkeypatch 한다
AMPLITUDE = 0.5  # 클리핑 방지 상한


class MusicGenerator:
    async def generate(
        self,
        prompt: str,
        context: ProjectContextSnapshot,
        length_beats: float,
        *,
        on_progress: ProgressFn,
        cancelled: asyncio.Event,
    ) -> tuple[bytes, AudioResult]:
        del prompt  # mock 은 프롬프트를 해석하지 않는다 — 실모델의 입력 자리
        on_progress(0.0, "loading_model")
        await asyncio.sleep(STEP_DELAY_SEC)

        spb = 60.0 / context.bpm  # seconds per beat
        semi = PITCH_TO_SEMITONE[context.key.tonic] if context.key else 0
        freq = 440.0 * 2 ** ((36 + semi - 69) / 12)  # tonic, 옥타브 2
        beats = max(1, min(math.ceil(length_beats), MAX_MOCK_BEATS))

        frames = array("h")
        for b in range(beats):  # beat = 취소 체크포인트 + 진행률 단위
            if cancelled.is_set():
                raise asyncio.CancelledError
            n_samples = int((b + 1) * spb * SAMPLE_RATE) - int(b * spb * SAMPLE_RATE)
            for n in range(n_samples):  # beat당 지수 감쇠 톤 펄스 — bpm이 귀로 확인된다
                t = n / SAMPLE_RATE
                frames.append(
                    int(math.sin(2 * math.pi * freq * t) * math.exp(-6.0 * t / spb) * AMPLITUDE * 32767)
                )
            on_progress(0.1 + 0.8 * (b + 1) / beats, "generating")
            await asyncio.sleep(STEP_DELAY_SEC)  # 취소 시 여기서 CancelledError

        on_progress(0.95, "encoding")
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(frames.tobytes())
        return buf.getvalue(), AudioResult(
            duration_sec=len(frames) / SAMPLE_RATE,
            suggested_length_beats=float(beats),
        )
