# Agent Teams - hyunMM AI DAW 구성과 프로세스

이 파일은 `/tr`, `/rs`, `/sw` 호출 시 따르는 팀 협업 절차의 단일 출처다. 작업 루트는 hyunMM 단일 repo이며, Electron(app/) + React 렌더러(renderer/) + Python AI 서비스(service/)가 함께 있다.

## 0. 기본 모델

- `main`은 퍼실리테이터다. 역할 멤버(PM, Designer, Developer, Reviewer)의 의견을 받아 중계하고, 합의 게이트와 검증 실행을 관리한다.
- 파일 수정은 main이 단일 작성자로 적용한다. 여러 agent가 동시에 같은 파일을 수정하지 않는다.
- 읽기, 조사, 리뷰는 역할 멤버가 자기 컨텍스트에서 직접 수행한다.
- 제품 정체성(AI DAW — 사람이 주도, AI가 협업)에 어긋나는 설계는 어느 멤버든 이의를 제기한다.

## 1. 작업 대상별 구성

`/tr`, `/rs`, `/sw`가 시작되면 작업 대상을 먼저 판별하고 필요한 역할 멤버를 스폰한다.

| 작업 대상 | 멤버 구성 | 주 관심사 |
| --- | --- | --- |
| 렌더러 UI | PM 1 / Designer 2 / Developer 2 / Reviewer 2 | `renderer/src/features/*`, zustand selector, 로딩/에러/빈 상태, 접근성 |
| 오디오 엔진 | PM 1 / Developer 2 / Reviewer 2 | `renderer/src/audio-engine/`, Web Audio 그래프, 스케줄러, 콜백 내 할당 금지, 레이턴시 |
| Electron 셸 | PM 1 / Developer 1 / Reviewer 2 | `app/main`, `app/preload`, 프로세스 생명주기, IPC 보안(contextIsolation), 파일 IO |
| AI 서비스 | PM 1 / Developer 2 / Reviewer 2 | `service/app/*`, agent 오케스트레이션, 생성 취소 가능성, VRAM, 모델 라이선스 |
| 계약 (renderer↔service) | PM 1 / Designer 1 / Developer 2 / Reviewer 2 | API payload, WS 메시지, project.json 스키마, `docs/api/` 동기화 |
| 문서/설정 | PM 1 / Developer 1 / Reviewer 1 | `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.codex/`, docs 정합성 |

역할 정의는 `.claude/agents/{pm,designer,developer,reviewer}.md`가 단일 출처다.

## 2. 멤버 성격

모든 멤버는 근거 없는 동의, 코드 미확인 단정, 검증 생략을 허용하지 않는다. 반대할 때는 반드시 근거와 대안을 함께 낸다. 비평은 사안에 한하고 사람 공격은 금지한다.

## 3. `/tr` 구현 작업

1. 명령을 분석하고 작업 대상을 판별한다.
2. `CLAUDE.md`, `AGENTS.md`, `package.json`(또는 `service/pyproject.toml`), 관련 진입점을 읽는다.
3. `git status --short --branch`와 `git branch -a`를 확인한다.
4. 역할별로 조사 결과와 계획을 낸다.
5. 이견이 있으면 main이 중계해 토론하고, 미확정 항목이 없어질 때까지 반복한다.
6. 합의된 변경만 main이 적용한다. renderer↔service 계약 변경은 양쪽 + `docs/api/`를 같은 작업에서 갱신한다.
7. 코드 변경이면 범위에 맞는 검증을 실행한다.
   - FE/Electron: `npm run typecheck`, `npm run lint`, 관련 `npm test`, 필요 시 `npm run build`, UI면 실행 확인
   - 서비스: Python import/syntax 확인, 관련 pytest 또는 최소 실행 경로 확인
   - 오디오 동작(재생·글리치·레이턴시)은 자동 검증이 어려우면 "실청취 미확인"을 명시
   - 문서/설정: 앱 검증 생략 가능, 생략 사유 보고
8. Reviewer가 변경 파일과 검증 결과를 확인한다.
9. 최종 보고에는 수정한 핵심 내용, 영향 파일/영역, 검증 결과, 미검증 또는 주의할 점을 포함한다.

## 4. `/rs` 읽기 전용 조사

1. 파일을 수정하지 않는다.
2. 관련 진입점과 호출/데이터 흐름을 실제 파일 기준으로 추적한다.
3. 확인된 사실, 파일 근거, 미확정 사항, 권장 조치를 분리해 보고한다.
4. 시크릿·토큰·모델 계정 정보는 출력하지 않는다.

## 5. `/sw` 작은 작업

1. 직접 관련 파일만 읽고 최소 변경으로 처리한다.
2. 렌더러/Electron/서비스 경계가 애매하면 필요한 역할 관점으로 먼저 조사한다.
3. 코드 변경이면 기본 검증(`npm run typecheck` + `npm run lint`, 서비스는 import 확인)을 수행하고, 문서/설정만 바꿨으면 검증 생략 사유를 보고한다.
4. 커밋, push, 배포, 삭제, 의존성 설치는 사용자 요청 없이 하지 않는다.

## 6. 검증 기준

- "통과"는 근거 파일을 확인한 뒤 명시적으로 말한다.
- "실행 확인"과 "파일 기준"을 구분한다. 실제 실행(브라우저/오디오/서비스 기동)을 못 했으면 그렇게 쓴다.
- `.env*`, 인증 파일, 토큰은 읽거나 외부로 보내지 않는다.

## 7. 외부 검증

외부 검증이 필요한 경우 `.claude/codex-round.md`를 따른다. allowlist에는 변경 검증에 필요한 파일만 포함하고, `.env*`, 인증 파일, 토큰은 제외한다.
