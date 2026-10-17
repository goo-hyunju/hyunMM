# 생성 API 계약 v1

> 코드 표현: `renderer/src/app/types/serviceContract.ts` (TS) · `service/app/api/schemas.py` (pydantic).
> 공통 규칙·에러 봉투는 `conventions.md`, 스냅샷 스키마는 `project-schema.md` 참조.
> 서비스는 mock 생성기로 계약 전체가 동작한다(`service/app/api/jobs.py`). 실모델 교체는 생성기
> `generate()` 시그니처를 유지한 채 진행한다. `/analyze`만 501 스텁.

## 원칙

- **생성 요청에는 항상 프로젝트 컨텍스트 스냅샷이 포함된다.** 컨텍스트 없는 프롬프트 단독 생성
  경로는 계약에 없다 — "프롬프트→완성곡" 생성기가 아니라 AI DAW다.
- **출력 단위는 곡이 아니라 클립이다** (오디오 스템 또는 MIDI).
- **모든 생성 작업은 취소 가능하다** (수십 초짜리 생성 중 사용자는 작업을 계속한다).
- v1 스냅샷은 **메타데이터만** 전송한다. 서비스는 프로젝트 폴더 경로를 모르고, 클립 미디어
  내용도 받지 않는다 (오디오 내용 조건 생성은 추후 별도 협상).

## 엔드포인트

| 메서드 | 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|---|
| POST | `/generate` | `GenerateRequest` | 202 `GenerateJob` | 즉시 반환, 작업은 비동기 |
| GET | `/jobs/{jobId}` | — | 200 `GenerateJob` | 상태 스냅샷. WS 단절 후 복구용 |
| GET | `/jobs/{jobId}/result` | — | 200 바이트 | `audio/wav`(16bit PCM) 또는 `audio/midi`(SMF 0). succeeded에서만 |
| POST | `/jobs/{jobId}/cancel` | — | 202 `CancelResponse` | **멱등** — 종료된 job이면 `already_finished` |
| WS | `/ws/jobs/{jobId}` | — | `JobWsMessage` 스트림 | job당 소켓 1개 |
| GET | `/health` | — | `{"status":"ok"}` | 기존 유지 |

MVP는 동시 생성 1개 — 진행 중 `/generate` 재요청은 409 + `SERVICE_BUSY`.

## job 상태 기계

```
queued → running → succeeded | failed | cancelled
queued → cancelled            (실행 전 취소 — 구현상 가능, 상태는 cancelled로 종료)
```

- 종료 상태(succeeded/failed/cancelled)는 최종이다. succeeded 직후 cancel이 와도 상태는 바뀌지
  않는다(`already_finished`).
- **WS 단절 ≠ 취소.** 렌더러 리로드 등 우발적 단절이 생성을 죽이지 않는다. 취소는 명시적
  `POST /jobs/{jobId}/cancel` 만이다.

## 요청 예시

```json
POST /generate
{
	"prompt": "어두운 808 베이스라인, 미니멀하게",
	"output": { "kind": "midi", "lengthBeats": 16 },
	"targetTrackId": "trk_d4e5f6",
	"context": {
		"bpm": 120,
		"timeSignature": { "numerator": 4, "denominator": 4 },
		"key": { "tonic": "C", "mode": "minor" },
		"tracks": [ ... ],
		"clips": [ ... ]
	}
}

202 → { "jobId": "job_20260824_001", "status": "queued", "stage": "queued" }
```

- `prompt`는 1~2000자 — 렌더러 UI가 사전 차단한다(초과 시 422).
- `output.kind`(`"audio" | "midi"`)가 music_generator / midi_generator 라우팅 키다.
- `targetTrackId`는 null 허용 — 새 트랙 제안 케이스. 생략은 불가(명시적 null).
- `context.tracks`가 빈 배열이어도 유효하다 (신규 프로젝트에서의 첫 생성).
- **스냅샷은 계약에 정의된 필드만 화이트리스트로 구성해 보낸다.** project.json의 "알 수 없는 필드
  보존" 규칙으로 살아남은 미지 필드를 그대로 넣으면 서비스의 `extra="forbid"`에 걸려 422다.

## WS 메시지 (`/ws/jobs/{jobId}`)

```json
{ "type": "progress",  "jobId": "job_20260824_001", "progress": 0.42, "stage": "generating" }
{ "type": "succeeded", "jobId": "job_20260824_001",
  "result": { "kind": "midi", "lengthBeats": 16 } }
{ "type": "failed",    "jobId": "job_20260824_001",
  "error": { "code": "GENERATION_FAILED", "message": "..." } }
{ "type": "cancelled", "jobId": "job_20260824_001" }
```

- `stage`: `"queued" | "loading_model" | "generating" | "encoding"` — UI 문구 매핑용.
- `progress` 생략 = indeterminate. mock↔실모델 간 진행률 정밀도 차이를 흡수한다.
- 오디오 결과 메타: `{ "kind": "audio", "durationSec": 8.0, "suggestedLengthBeats": 16 }`.

## 결과 수신 → 미리듣기 → 수락 흐름

렌더러는 fs 접근이 없고, 서비스는 프로젝트 폴더를 모른다. 결과 바이트는 HTTP로 흐른다.

```
renderer                    service                     Electron main
   │  POST /generate           │                            │
   │─────────────────────────▶│ (staging 디렉터리에 생성)     │
   │  WS progress...           │                            │
   │◀─────────────────────────│                            │
   │  WS succeeded             │                            │
   │  GET /jobs/{id}/result    │                            │
   │◀───────── bytes ─────────│                            │
   │  decodeAudioData → 프리뷰 버스에서 미리듣기               │
   │                                                        │
   │  [수락 시에만]  IPC saveClipMedia(name, relPath, bytes)  │
   │───────────────────────────────────────────────────────▶│ projects/<이름>/audio|midi/ 저장
   │  project.json에 클립 추가 (origin: {source:"ai", jobId})
```

- 서비스는 결과를 **자기 staging 디렉터리**(gitignore 대상)에만 쓴다. 프로젝트 폴더에 직접 쓰지
  않는다 — 거절된 출력이 프로젝트를 오염시키지 않는다(수락/거절 주권은 사용자).
- 거절 시 디스크에 아무것도 남지 않는다. staging 정리 정책(종료 시 삭제 vs 세션 캐시)은 TODO.
- 프리뷰 재생 위치는 store에 넣지 않는다 — audio-engine + rAF (`useTransportStore.ts` 원칙).

## 구현 시 선행 요구사항 (이 계약이 만드는 숙제)

- `app/preload`에 `saveClipMedia` IPC 추가 (수락 흐름).
- 렌더러 MIDI 프리뷰용 SMF 파싱 수단 — 신규 의존성이면 사용자 승인 필요.
- 렌더러 serviceClient 함수 시그니처(구현은 mock 생성기 단계):
  - `postGenerate(req: GenerateRequest): Promise<GenerateJob>`
  - `getJob(jobId: string): Promise<GenerateJob>`
  - `fetchJobResult(jobId: string): Promise<ArrayBuffer>`
  - `cancelJob(jobId: string): Promise<CancelResponse>`
  - `openJobSocket(jobId: string, onMessage: (m: JobWsMessage) => void, onDisconnect?: () => void): () => void`
    (반환값은 close. onDisconnect는 호출측 close 이전의 단절에서 호출 — getJob 폴링 폴백 트리거)

## 범위 밖 (v1)

- `/analyze` 계약 — 스텁만 존재, 사용 시점에 정의.
- 스타일 전이·오디오 입력 조건 생성, 컨텍스트 diff 전송(스냅샷 비대화 시 검토), 동시 다중 job.
