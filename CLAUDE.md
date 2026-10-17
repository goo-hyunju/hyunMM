# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 최초 작성: 2026-08-24 (v0.1.0 스캐폴드). 구조가 바뀌면 이 문서를 같이 갱신한다.

## 프로젝트 정의

hyunMM은 **AI DAW**다. "AI가 음악을 만들어주는 프로그램"이 아니라, **사람이 DAW처럼 음악을 조작하면 AI가 그 작업 맥락을 이해하고 함께 편곡·생성하는** 데스크톱 앱이다. 이 정의가 모든 기능 판단의 기준이다.

- **사용자가 주체다.** 드럼패드·가상 키보드·타임라인·믹서로 직접 음악을 만든다. DAW가 본체다.
- **AI는 협업자다.** 현재 프로젝트 상태(트랙 구성, 클립, BPM, 키, 사용자가 녹음한 루프)를 컨텍스트로 받아 "여기에 어울리는 베이스라인", "이 드럼 더 어둡게" 같은 요청을 처리한다.
- **AI 출력은 완성곡이 아니라 클립이다.** 오디오 스템 또는 MIDI 클립으로 타임라인에 올라가고, 수락·수정·삭제는 사용자가 한다.

기획 원본: `docs/planning/product-plan.md`
구조 설계 결정: `docs/superpowers/specs/2026-08-24-ai-daw-structure-design.md`

## 현재 상태

**MVP 1~4 완료 (v0.2.x).** 생성 API 계약 v1, transport/timeline, mock 생성기 왕복(생성→진행률→미리듣기→수락), 드럼패드·키·믹서 UI까지 구현되어 있다. 미구현: `project.json` 저장/로드, 클립 오디오 재생, 이펙트·오토메이션, 실모델 추론, 패키징. 영역별 구현 상태의 단일 출처는 `README.md`의 "구현 현황" 표다. 새 의존성 추가(`npm install` / `pip install`)는 전역 규칙대로 **사용자 승인 후** 진행한다.

## 아키텍처

Electron 통합 앱 + 로컬 Python AI 서비스. 통신 구조:

```
Electron main (app/main) ──spawn──▶ Python FastAPI 서비스 (service/, localhost:8930)
      │ IPC (app/preload)                     ▲
      ▼                                       │ HTTP + WebSocket
Renderer (renderer/, React 19 + TS + Web Audio)
      │
      ▼
로컬 프로젝트 파일 (projects/<이름>/project.json + audio/ + midi/ + samples/)
```

핵심 원칙:

- **재생·믹싱·이펙트 등 실시간 오디오는 렌더러의 Web Audio 엔진에서 처리한다.** Python 왕복 없음 — 저지연이 목적이다.
- **AI 생성·분석은 Python 서비스에서.** 생성은 수 초~수십 초 걸리는 비동기 작업이며 진행률은 WebSocket으로 스트리밍한다.
- **Electron main은 창 관리·서비스 프로세스 생명주기·파일 IO만 담당한다.** 도메인 로직을 넣지 않는다.
- **DB 없음.** 저장은 로컬 프로젝트 파일(project.json + 미디어 폴더)이다.

### 디렉터리

| 경로 | 역할 |
|---|---|
| `app/main/` | Electron main — 창, Python 서비스 spawn/종료, 프로젝트 파일 IO |
| `app/preload/` | contextBridge로 렌더러에 안전한 IPC API 노출 |
| `renderer/src/app/` | 부트스트랩, 전역 상태(zustand), 서비스 클라이언트(HTTP/WS) |
| `renderer/src/audio-engine/` | Web Audio 그래프, transport, 스케줄러, 이펙트 체인 |
| `renderer/src/features/drum-pad/` | 드럼패드 입력·비트 녹음 |
| `renderer/src/features/keys/` | 가상 키보드 + 외부 MIDI 입력 |
| `renderer/src/features/timeline/` | 멀티트랙 타임라인·클립 편집 |
| `renderer/src/features/transport/` | 재생·정지·BPM 컨트롤 UI |
| `renderer/src/features/mixer/` | 볼륨·팬·솔로·뮤트 |
| `renderer/src/features/effects/` | 이펙트 랙 UI |
| `renderer/src/features/automation/` | 오토메이션 레인 |
| `renderer/src/features/ai-copilot/` | AI 요청 패널, 생성 결과 미리듣기·수락 |
| `service/app/api/` | FastAPI REST + WebSocket 엔드포인트 |
| `service/app/agent/` | AI Agent — 프로젝트 컨텍스트 해석, 요청 분해, 생성기 오케스트레이션 |
| `service/app/generation/` | music_generator(오디오 스템), midi_generator(MIDI 패턴) |
| `service/app/analysis/` | 사용자 녹음 루프의 BPM·키·온셋 분석 |
| `service/app/models/` | 모델 체크포인트 로드/언로드, VRAM 관리 |
| `projects/` | 사용자 프로젝트 파일 (gitignore 대상) |
| `docs/api/` | renderer↔service API 계약 문서 |

## Commands

```bash
npm run dev          # electron-vite dev — main/preload/renderer 동시 기동 + 서비스 spawn
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm test             # vitest run
npm run build        # typecheck + electron-vite build
npm run service:dev  # Python 서비스 단독 실행 (uvicorn --reload, service/.venv 필요)
```

- 서비스 포트 **8930**은 `app/shared/servicePort.ts`(TS 단일 출처 — main/preload/renderer가 import)와 `service/app/main.py` 두 곳에 상수로 존재한다. 바꾸면 둘 다 바꾼다.
- Python 서비스 의존성은 `service/pyproject.toml`. AI 관련 무거운 의존성(torch 등)은 optional group `ai`로 분리되어 있다.

## 브랜치·커밋 규칙

- 메인 개발 브랜치는 **`develop`**.
- 커밋은 전역 규칙을 따른다: `package.json` version bump(`release.feature.fix`) + 커밋 메시지 `version X.Y.Z, 작업내용`.
- **사용자가 명시적으로 요청하기 전에는 커밋하지 않는다.**

## 경계 규칙 (renderer ↔ service)

- API payload, WebSocket 메시지, `project.json` 스키마처럼 **양쪽이 함께 영향을 받는 계약**은 구현 전에 계약을 먼저 정의하고, 변경 시 renderer 타입·service 스키마·`docs/api/` 문서를 같은 커밋에서 갱신한다.
- 렌더러는 서비스의 내부 모듈 구조를 모른다. HTTP/WS 계약으로만 통신한다.

## Gotchas

- **오디오 콜백·스케줄러 루프 안에서 객체/배열을 새로 할당하지 않는다.** 전역 규칙 성능 절과 동일. GC 스파이크는 오디오 글리치로 직결된다.
- **AI 모델 체크포인트는 커밋 금지.** `service/checkpoints/`는 gitignore 대상이다.
- **생성 요청은 항상 취소 가능해야 한다.** 수십 초짜리 생성 중 사용자가 작업을 계속할 수 있어야 한다(AI DAW의 전제).
- zustand는 전역 규칙대로 selector 구독. 특히 transport 상태(재생 위치)는 고빈도 갱신이므로 구독 범위를 최소화한다.

## 에이전트 팀

`/tr`(구현), `/rs`(조사), `/sw`(작은 작업) 커맨드와 `.claude/agent-teams.md`를 따른다. Codex 연동은 `.codex/README.md`, 외부 검증은 `.claude/codex-round.md`.

`.claude/`와 `.codex/`는 **로컬 전용 설정**이라 git 추적 대상이 아니다(`.gitignore`). 공개 저장소에는 올라가지 않으며, 이 절은 해당 파일을 가진 로컬 환경에서만 유효하다.
