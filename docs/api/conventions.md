# API 공통 규칙 (renderer ↔ service)

> 이 디렉터리는 renderer↔service 계약의 단일 출처다. 계약 변경 시
> `renderer/src/app/types/{project,serviceContract}.ts` + `service/app/api/schemas.py` + 이 문서들을
> **같은 커밋**에서 갱신한다 (CLAUDE.md 경계 규칙).

## Base URL / 포트

- `http://127.0.0.1:8930` — 로컬 전용, 외부 바인딩 금지.
- CORS: 렌더러는 dev에서 `http://localhost:<포트>` origin이므로 서비스가 로컬 origin의
  교차 출처 요청을 허용한다 (`service/app/main.py`의 CORSMiddleware, 로컬 origin 한정).
  TODO 패키징: `loadFile`(file:// origin)로 전환하면 이 regex에 걸리지 않는다 — 프로덕션
  로드 방식 확정 시 재검토.
- 포트 상수는 `app/main/index.ts` 와 `service/app/main.py` 두 곳에 있다. **바꾸면 둘 다 바꾼다.**
- WebSocket은 `ws://127.0.0.1:8930/ws/...`.

## Wire 포맷

- JSON 필드는 **camelCase**. Python 내부는 snake_case이며 pydantic `alias_generator=to_camel` 로 변환한다
  (`service/app/api/schemas.py` 의 `ContractModel` 베이스, pydantic 2.11+ `serialize_by_alias` 사용).
- 계약에 없는 필드는 요청에서 거부된다(`extra="forbid"` → 422).
- **None/미지정 필드는 wire에서 `null`이 아니라 생략한다** (TS optional과 일치).
  REST는 라우트의 `response_model_exclude_none=True`, WS 등 수동 직렬화는 `schemas.to_wire()` 헬퍼를
  반드시 경유한다. `null`을 값으로 갖는 필드(`key`, `targetTrackId`)는 예외 — 명시적으로 `null`을 보낸다.

## 단위 규약

| 값 | 단위 | 근거 |
|---|---|---|
| 타임라인 위치·길이 (`startBeat`, `lengthBeats`) | beat (부동소수) | BPM 변경에도 음악적 위치 불변 (DAW 관례) |
| 오디오 물리 길이 (`durationSec`) | 초 | 미디어의 진실은 파일 — 스키마 값은 레이아웃 캐시 |
| `volume` | 선형 게인, 1 = unity, 0~2 | Web Audio GainNode 값 그대로. dB 표시는 UI 관심사 |
| `pan` | -1(L) ~ 1(R) | StereoPannerNode 값 그대로 |
| `progress` | 0~1 부동소수, 생략 시 indeterminate | mock↔실모델 간 진행률 정밀도 차이 흡수 |

## ID 규약

접두사 문자열 id를 쓴다: 트랙 `trk_`, 클립 `clp_`, 생성 job `job_`. 배열 index·숫자 id 금지
(React key 안정성, 로그 가독성).

## 에러 응답

- REST 에러 본문은 FastAPI 관례의 `detail` 봉투를 쓴다. 계약 에러는 `detail` 안에 구조화한다:

  ```json
  { "detail": { "code": "SERVICE_BUSY", "message": "다른 생성 작업이 진행 중입니다" } }
  ```

- 요청 스키마 위반은 FastAPI 표준 422 응답 그대로.
- 에러 코드 열거형: `SERVICE_BUSY`, `MODEL_NOT_LOADED`, `INVALID_CONTEXT`, `GENERATION_FAILED`.
  코드 추가는 비파괴 변경, 의미 변경·제거는 breaking.

## 계약 변경 원칙

- **필드 추가는 optional로만** — required 필드 추가·제거·의미 변경은 breaking이며 `schemaVersion` bump 대상.
- 진행률·stage 등 표시용 값은 렌더러가 모르는 값이 와도 무시하고 동작해야 한다(전방 호환).
