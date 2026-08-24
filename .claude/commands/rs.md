---
description: hyunMM agent teams 읽기 전용 조사/검증 모드
argument-hint: <조사·검증할 내용>
---

# /rs - Agent Teams 조사와 검증

**조사 대상:** $ARGUMENTS

착수 전 `.claude/agent-teams.md`를 먼저 읽는다. 이 명령은 읽기 전용이다.

## 필수 이행

1. `CLAUDE.md`, `AGENTS.md`, `package.json`(서비스면 `service/pyproject.toml`), 관련 진입점을 읽는다.
2. 파일 수정, 구현, 포맷 변경을 하지 않는다.
3. 렌더러 UI, 오디오 엔진, Electron 셸, AI 서비스, 계약(renderer↔service), 문서/설정 중 작업 대상을 판별하고 해당 관점으로 추적한다.
4. 확인된 사실과 추정을 분리한다. 추정은 "미검증"으로 표시한다.
5. 결론은 파일 근거, 미확정 사항, 권장 조치와 함께 한국어로 보고한다.
6. 시크릿, 토큰, 인증 정보를 출력하지 않는다.

## 산출 형식

- 확인된 사실.
- 파일 근거.
- 미확정 사항.
- 권장 조치.
