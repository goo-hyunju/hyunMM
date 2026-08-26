# project.json 스키마 v1

> 코드 표현: `renderer/src/app/types/project.ts` (TS) ·
> `service/app/api/schemas.py` (컨텍스트 스냅샷용 부분집합).
> 단위·id 규약은 `conventions.md` 참조.

프로젝트는 `projects/<이름>/` 폴더 하나가 단위다. DB 없음.

```
projects/<이름>/
├── project.json     # 이 문서의 스키마
├── audio/           # 오디오 클립 미디어 (wav)
├── midi/            # MIDI 클립 미디어 (SMF format 0)
└── samples/         # 드럼패드 원샷 등 (v1 스키마 미편입 — 드럼패드 구현 시 논의)
```

## 전체 예시

```json
{
	"schemaVersion": 1,
	"name": "my-first-beat",
	"bpm": 120,
	"timeSignature": { "numerator": 4, "denominator": 4 },
	"key": { "tonic": "C", "mode": "minor" },
	"tracks": [
		{ "id": "trk_a1b2c3", "name": "Drums", "kind": "audio", "volume": 1.0, "pan": 0, "mute": false, "solo": false },
		{ "id": "trk_d4e5f6", "name": "Bass", "kind": "midi", "volume": 0.8, "pan": -0.2, "mute": false, "solo": false }
	],
	"clips": [
		{
			"id": "clp_x1y2z3",
			"trackId": "trk_a1b2c3",
			"name": "drum loop 1",
			"startBeat": 0,
			"lengthBeats": 16,
			"media": { "kind": "audio", "path": "audio/clp_x1y2z3.wav", "durationSec": 8.0 },
			"origin": { "source": "user" }
		},
		{
			"id": "clp_m4n5o6",
			"trackId": "trk_d4e5f6",
			"name": "AI bassline",
			"startBeat": 16,
			"lengthBeats": 16,
			"media": { "kind": "midi", "path": "midi/clp_m4n5o6.mid" },
			"origin": { "source": "ai", "jobId": "job_20260824_001", "prompt": "어두운 808 베이스라인" }
		}
	],
	"createdAt": "2026-08-24T09:00:00Z",
	"updatedAt": "2026-08-24T10:30:00Z"
}
```

## 필드

| 필드 | 타입 | 비고 |
|---|---|---|
| `schemaVersion` | int, 현재 `1` | 마이그레이션 단위. semver 아님 |
| `name` | string | 폴더명이 프로젝트 정체성 — 별도 id 없음 |
| `bpm` | number > 0 | |
| `timeSignature` | `{numerator, denominator}` | numerator > 0 정수, denominator는 1·2·4·8·16 |
| `key` | `{tonic, mode}` \| null | null = 미지정. 자유 문자열 금지(표기 흔들림 방지) |
| `tracks[]` | Track | 아래 참조 |
| `clips[]` | Clip | **평탄 구조** — 트랙 중첩 아님. 클립의 트랙 이동은 `trackId` 한 필드 변경 |
| `createdAt`·`updatedAt` | ISO 8601 string | |

### Track

`id`, `name`, `kind`(`"audio" | "midi"` — 트랙 타입 고정, 혼합 트랙 없음), `volume`(선형 0~2),
`pan`(-1~1), `mute`, `solo`. 이펙트·오토메이션·`instrumentId`는 v1 제외 — optional 추가는 비파괴이므로
필요 시점에 도입한다.

### Clip

- `startBeat` / `lengthBeats`: 타임라인 배치는 **beat 단위**. BPM을 바꿔도 "4마디째 클립"은 4마디째다.
  제약: `startBeat ≥ 0`, `lengthBeats > 0`, 오디오 `durationSec > 0`.
- `media`: `kind`로 판별되는 union.
  - `audio`: `path` + `durationSec`(레이아웃 계산용 캐시 — 진실은 파일 헤더).
  - `midi`: `path`만. 노트 데이터는 SMF 파일이 보유(내부 PPQ는 파일 소관).
- **`media.path`는 프로젝트 폴더 기준 상대경로만 허용. 절대경로 금지** — 폴더째 이동·복사해도 깨지지 않아야 한다.
- `media.kind`는 참조하는 트랙의 `kind`와 일치해야 한다 (로드 시 검증 대상 불변식).
- `origin`: `{source: "user" | "ai"}`. AI 생성 클립은 `jobId`·`prompt`로 출처를 추적한다 —
  수락된 클립만 여기 들어온다는 것이 AI DAW의 전제.

## 타임스트레치 없음 (MVP 한계)

오디오의 물리 길이는 고정이므로, BPM 변경 시 오디오 클립의 `lengthBeats`(그리드 점유)와 실제 소리
길이가 어긋날 수 있다. v1은 이를 허용하고 스키마는 `durationSec` 캐시로 어긋남을 계산 가능하게 한다.
타임스트레치는 v2 이후.

## 로드 규칙

- `schemaVersion`이 앱 지원 버전보다 **크면 열지 않고 에러**를 낸다.
- 알 수 없는 필드는 **보존**한다 (미래 버전과의 왕복 안전).
- 필드 추가는 optional로만. required 변경은 `schemaVersion` bump.
