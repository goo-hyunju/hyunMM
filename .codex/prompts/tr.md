# Codex TR - hyunMM 팀 기반 구현 작업

아래 작업을 `AGENTS.md`의 규칙대로 수행한다. 이 프로젝트는 AI DAW다 — 사람이 DAW로 조작하고 AI가 클립 단위로 협업한다.

필수:

1. 먼저 `AGENTS.md`, `CLAUDE.md`, `package.json`(서비스면 `service/pyproject.toml`), 관련 진입점을 읽는다.
2. `git status --short --branch`와 `git branch -a`로 현재 상태를 확인한다.
3. 렌더러/Electron 변경이면 `mm_mapper -> mm_renderer_worker -> mm_reviewer` 순서로 subagent 사용을 시도한다.
4. AI 서비스 변경이면 `mm_mapper -> mm_ai_worker -> mm_reviewer` 순서로 subagent 사용을 시도한다.
5. renderer↔service 계약 변경이면 양쪽 worker를 순차로 쓰되 같은 계약 기준을 공유시키고, `docs/api/`를 같이 갱신한다.
6. subagent 도구가 현재 표면에서 불가능하면 같은 절차를 main Codex가 명시적으로 수행한다.
7. 구현은 한 작성자만 수행한다. 여러 agent가 동시에 파일을 수정하게 하지 않는다.
8. FE 코드 변경 후 기본 검증은 `npm run typecheck`와 `npm run lint`다. 서비스는 Python import/syntax 확인이다. 관련 테스트/build/실행 확인은 변경 범위에 맞게 수행한다.
9. 커밋, push, 배포, 삭제, 의존성 설치, 모델 다운로드는 사용자 명시 요청 전에는 하지 않는다.
10. 최종 보고는 한국어로, 변경 파일과 검증 결과를 짧게 쓴다.

작업:
