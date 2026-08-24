---
description: hyunMM 작은 작업을 빠르게 처리
argument-hint: <수행할 작업/명령 내용>
---

# /sw - 작은 작업 빠른 처리

**대상 명령:** $ARGUMENTS

작은 작업을 직접 관련 파일 중심으로 빠르게 처리한다. 그래도 `CLAUDE.md`, `AGENTS.md`, 실제 코드 근거를 우선한다.

## 필수 이행

1. 직접 관련 파일을 읽고 최소 변경으로 끝낸다.
2. 렌더러/Electron/서비스 경계가 애매하면 `.claude/agent-teams.md`의 역할 관점으로 먼저 조사한다.
3. renderer↔service 계약(payload, WS 메시지, project.json, 공유 상수)이 걸리면 한쪽만 고치지 않는다.
4. FE 코드 변경 후 기본 검증은 `npm run typecheck`와 `npm run lint`다. 서비스는 Python import/syntax 확인이다.
5. 문서/설정만 바꿨으면 앱 검증을 생략하고 이유를 보고한다.
6. 커밋, push, 배포, 삭제, 의존성 설치는 사용자가 명시적으로 요청하기 전에는 하지 않는다.

## 산출 형식

- 수정한 핵심 내용.
- 영향 파일/영역.
- 검증 결과.
- 미검증 또는 주의할 점.
