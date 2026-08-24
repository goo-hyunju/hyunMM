# Codex RS - hyunMM 팀 기반 조사/검증

아래 대상을 읽기 전용으로 조사한다. 코드나 문서는 수정하지 않는다.

필수:

1. 먼저 `AGENTS.md`, `CLAUDE.md`, `package.json`(서비스면 `service/pyproject.toml`), 관련 진입점을 읽는다.
2. `mm_mapper`로 app/renderer/service 구조와 관련 코드 경로를 추적한다.
3. renderer↔service 계약이 핵심이면 양쪽 코드와 `docs/api/`를 대조한다.
4. 마지막에 `mm_reviewer` 관점으로 사실 오류, 추정, 검증 공백, 보안 위험을 찾는다.
5. subagent 도구가 현재 표면에서 불가능하면 같은 절차를 main Codex가 명시적으로 수행한다.
6. 결론은 확인된 사실, 파일 근거, 미확정 사항, 권장 조치로 나눠 한국어로 보고한다.
7. 시크릿, 토큰, 인증 정보를 출력하지 않는다.

조사 대상:
