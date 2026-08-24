"""hyunMM AI 서비스 엔트리포인트.

Electron main(app/main/index.ts)이 spawn 하며, 렌더러가 localhost HTTP/WS로 통신한다.
"""

from fastapi import FastAPI

from app.api.routes import router as api_router

# app/main/index.ts 의 SERVICE_PORT 와 같은 값을 유지한다
SERVICE_PORT = 8930

app = FastAPI(title="hyunMM AI Service", version="0.1.0")
app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
