---
description: agent teams 프로세스로 hyunMM 구현 작업 수행
argument-hint: <수행할 작업/명령 내용>
---

# /tr - Agent Teams 구현 작업

**대상 명령:** $ARGUMENTS

착수 전 `.claude/agent-teams.md`를 먼저 읽는다. 작업 루트는 hyunMM 단일 repo다 — Electron(`app/`), React 렌더러(`renderer/`), Python AI 서비스(`service/`)가 함께 있다.

## 필수 이행

1. `CLAUDE.md`와 `AGENTS.md`의 절대 규칙을 준수한다. 제품 정체성은 AI DAW(사람 주도 + AI 협업)다.
2. 작업 대상을 렌더러 UI, 오디오 엔진, Electron 셸, AI 서비스, 계약(renderer↔service), 문서/설정 중에서 판별한다.
3. `git status --short --branch`와 `git branch -a`로 현재 상태를 확인한다.
4. `package.json`(서비스면 `service/pyproject.toml`), 관련 진입점을 실제로 읽고 근거를 확보한다.
5. `.claude/agent-teams.md`의 `/tr` 프로세스에 따라 조사, 계획, 합의, 작업, 검증, 리뷰, 보고를 수행한다.
6. renderer↔service 계약 변경은 renderer 타입 + service 스키마 + `docs/api/`를 같은 작업에서 갱신한다.
7. FE 코드 변경 후 기본 검증은 `npm run typecheck`와 `npm run lint`다. 관련 테스트와 build는 변경 범위에 맞게 실행한다. 서비스는 Python import/syntax와 관련 pytest다.
8. UI 변경은 가능한 경우 `npm run dev`로 실행 확인까지 수행한다. 오디오 동작을 실청취로 못 확인했으면 그 사실을 명시한다.
9. 커밋, push, 배포, 삭제, 의존성 설치, 모델 다운로드는 사용자가 명시적으로 요청하기 전에는 하지 않는다.

## 산출 형식

- 수정한 핵심 내용.
- 영향 파일/영역.
- 검증 결과.
- 미검증 또는 주의할 점.
