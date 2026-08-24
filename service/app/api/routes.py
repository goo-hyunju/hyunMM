"""REST + WebSocket 엔드포인트. 계약은 docs/api/ 에 정의한다.

생성 요청에는 항상 프로젝트 컨텍스트 스냅샷(트랙·클립·BPM·키)이 포함된다 — AI DAW의 전제.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/generate")
def generate() -> None:
    """생성 요청(오디오 스템/MIDI 클립). agent가 컨텍스트를 해석해 생성기를 오케스트레이션한다."""
    raise HTTPException(status_code=501, detail="미구현")


@router.post("/analyze")
def analyze() -> None:
    """사용자 녹음 루프 분석(BPM·키·온셋)."""
    raise HTTPException(status_code=501, detail="미구현")
