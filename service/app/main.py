"""hyunMM AI 서비스 엔트리포인트.

Electron main(app/main/index.ts)이 spawn 하며, 렌더러가 localhost HTTP/WS로 통신한다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router

# app/main/index.ts 의 SERVICE_PORT 와 같은 값을 유지한다
SERVICE_PORT = 8930

app = FastAPI(title="hyunMM AI Service", version="0.1.0")
# 렌더러(dev: electron-vite가 http://localhost:<포트>로 서빙)의 교차 출처 fetch 허용.
# 원격 서버 모드(--host 0.0.0.0)에서도 렌더러 origin은 각 클라이언트의 localhost다.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
