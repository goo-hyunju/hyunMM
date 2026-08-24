# hyunMM AI DAW — 초기 구조 설계 (2026-08-24)

## 결정 요약

기획서(`docs/planning/product-plan.md`)에 열려 있던 선택지들을 다음과 같이 확정했다.

| 항목 | 결정 | 근거 |
|---|---|---|
| 제품 컨셉 | **AI DAW** — 사람이 DAW로 조작, AI가 맥락을 이해하고 협업 | 사용자 확정. "프롬프트→완성곡" 생성기가 아님 |
| 아키텍처 | **Electron 통합 앱** + 로컬 Python 서비스 | 사용자 다이어그램. 데스크톱 배포 전제, 로컬 GPU 활용 |
| UI 스택 | React 19 + TypeScript + Web Audio API | 개발자 주력 스택, 실시간 오디오는 렌더러에서 처리 |
| AI 실행 | 오픈소스 모델 로컬 추론 (MusicGen 계열 후보) | 자체 학습 없음, 외부 API 의존 없음. 라이선스 확인 필요 |
| 저장 | 로컬 프로젝트 파일 (project.json + 미디어 폴더) | MVP에 DB 불필요 |
| 통신 | Electron main이 서비스 spawn, 렌더러↔서비스는 localhost HTTP/WS | 생성 진행률은 WS 스트리밍 |

기각한 대안: JUCE/C++ 단일 앱(주력 스택과 거리, MVP까지 오래 걸림), 웹 프론트+원격 백엔드(데스크톱 통합 배포로 방향 확정되며 흡수), DB 도입(MVP 범위 밖).

## AI DAW 컨셉이 구조에 주는 영향

- AI 계층의 중심은 텍스트→오디오 파이프라인이 아니라 **`service/app/agent/`** — 프로젝트 상태(트랙·클립·BPM·키·사용자 루프)를 컨텍스트로 받아 요청을 분해하고 generation/analysis를 오케스트레이션한다.
- AI 출력의 단위는 곡이 아니라 **클립**(오디오 스템 또는 MIDI). 렌더러의 `ai-copilot` feature가 미리듣기·수락·거절 UX를 담당하고, 수락된 클립만 타임라인에 들어간다.
- 렌더러가 서비스에 보내는 생성 요청에는 항상 **프로젝트 컨텍스트 스냅샷**이 포함된다(계약은 `docs/api/`에 정의 예정).

## 계층 책임

| 계층 | 책임 | 금지 |
|---|---|---|
| Electron main (`app/main`) | 창, Python 서비스 생명주기, 파일 IO | 도메인 로직 |
| Preload (`app/preload`) | contextBridge IPC 노출 | 렌더러에 node API 직접 노출 |
| Renderer (`renderer/`) | DAW UI 전체, Web Audio 실시간 엔진, 클라이언트 상태 | 서비스 내부 구조 의존 |
| Python 서비스 (`service/`) | AI 생성·분석·모델 관리, WS 진행률 | UI 관심사 |

## 디렉터리 구조

```
hyunMM/
├── app/{main,preload}/          # Electron
├── renderer/src/
│   ├── app/                     # 부트스트랩, zustand 상태, 서비스 클라이언트
│   ├── audio-engine/            # WebAudio 그래프, transport, 스케줄러
│   └── features/{drum-pad,keys,timeline,mixer,effects,automation,ai-copilot}/
├── service/app/{api,agent,generation,analysis,models}/
├── projects/                    # 사용자 프로젝트 (gitignore)
└── docs/{planning,api,superpowers/specs}/
```

## 이번 스캐폴드의 범위

- 포함: 디렉터리 골격, 각 계층 스텁 파일, 루트 툴링 설정(electron-vite/tsc/eslint/prettier/vitest), `.claude`/`.codex` 에이전트 구성 재작성, git init(develop) + 초기 커밋.
- 제외: `npm install`/`pip install`(사용자 승인 후), 모델 다운로드, 기능 구현.

## 다음 단계 (MVP 후보 순서)

1. 의존성 설치 승인 → dev 환경 기동 확인
2. `project.json` 스키마 + renderer↔service 생성 API 계약 정의 (`docs/api/`)
3. audio-engine transport(재생/정지/BPM) + timeline 최소 구현
4. 서비스 mock 생성기(샘플 반환) → ai-copilot 왕복 검증
5. MusicGen 계열 실모델 연결 (라이선스 확인 선행)
