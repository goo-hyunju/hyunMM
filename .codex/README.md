# hyunMM Codex 설정

이 폴더는 Codex가 hyunMM AI DAW 작업 루트에서 사용할 프로젝트별 보조 설정을 담는다. 단일 repo 안에 Electron(`app/`), React 렌더러(`renderer/`), Python AI 서비스(`service/`)가 함께 있다.

## agents

`.codex/agents/*.toml`은 Codex subagent 역할 정의다.

- `mm-mapper.toml`: 읽기 전용. app/renderer/service 구조, renderer↔service 계약, branch/commit 매핑.
- `mm-renderer-worker.toml`: 렌더러(React/TS/Web Audio)와 Electron main/preload 구현.
- `mm-ai-worker.toml`: Python 서비스(FastAPI, agent, generation, analysis, models) 구현.
- `mm-reviewer.toml`: 읽기 전용. 계약 불일치, 오디오 성능, Electron 보안, 검증 누락 리뷰.

## 사용 순서

- 조사: `mm_mapper` -> `mm_reviewer`
- 렌더러/Electron 구현: `mm_mapper` -> `mm_renderer_worker` -> `mm_reviewer`
- AI 서비스 구현: `mm_mapper` -> `mm_ai_worker` -> `mm_reviewer`
- 계약(renderer↔service) 변경: `mm_mapper` -> `mm_renderer_worker` + `mm_ai_worker`(순차, 같은 계약 기준) -> `mm_reviewer`
- 단순 문서/오타 수정: 필요하면 에이전트를 생략할 수 있다.

설정 변경 직후 기존 Codex 세션에는 예전 agent 목록이 캐시되어 있을 수 있다. `.codex/agents/*.toml`을 추가하거나 이름을 바꾼 뒤에는 새 Codex 세션을 열거나 Codex 앱/CLI를 재시작한다.

## prompts

`.codex/prompts/*.md`에 자주 쓰는 시작 프롬프트를 둔다.

- `tr.md`: 팀 기반 구현 작업.
- `rs.md`: 팀 기반 조사/검증.
- `sw.md`: 작은 작업 빠른 처리.

사용할 때는 파일 내용을 복사해 Codex 입력창 첫 줄에 붙이고, 뒤에 작업 내용을 적는다.

## 기준 문서

작업 전 `AGENTS.md`, `CLAUDE.md`, `package.json`(서비스면 `service/pyproject.toml`), 관련 진입점 파일을 우선 읽는다. 문서와 코드가 다르면 실제 코드를 우선한다.

시크릿·토큰·모델 계정 정보는 이 폴더의 어떤 파일에도 기록하지 않는다.
