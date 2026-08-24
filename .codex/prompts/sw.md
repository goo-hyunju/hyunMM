# Codex SW - hyunMM 작은 작업 빠른 처리

아래 작업을 작고 빠르게 처리한다.

필수:

1. `AGENTS.md`, `CLAUDE.md`, 직접 관련 파일만 읽는다.
2. 작업 전 branch/status를 확인한다.
3. 단순 작업이면 subagent를 생략할 수 있다.
4. 렌더러/Electron/서비스 경계가 애매하면 필요한 read-only agent(`mm_mapper`)만 먼저 사용한다.
5. 구현은 최소 변경으로 끝낸다. renderer↔service 계약이 걸리면 한쪽만 고치지 않는다.
6. FE 코드 변경 후 기본 검증은 `npm run typecheck`와 `npm run lint`다. 서비스는 Python import/syntax 확인이다.
7. 문서/설정만 바꿨으면 앱 검증을 생략하고 이유를 보고한다.
8. 커밋, push, 배포, 삭제, 의존성 설치는 사용자 명시 요청 전에는 하지 않는다.
9. 최종 보고는 한국어로 짧게 쓴다.

작업:
