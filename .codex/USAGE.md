# Codex를 hyunMM 작업 루트에서 쓰는 법

Codex는 Claude의 `.claude/commands/*.md`를 그대로 실행한다고 가정하지 않는다. 이 작업 루트에서는 아래 4가지를 조합해 작업 흐름을 맞춘다.

1. `AGENTS.md`: 항상 우선 적용하는 작업 루트 규칙.
2. `.codex/config.toml`: 프로젝트별 Codex 설정.
3. `.codex/agents/*.toml`: 역할별 subagent 정의.
4. `.codex/prompts/*.md`: `/tr`, `/rs`, `/sw`처럼 복사해서 쓰는 시작 프롬프트.

## 처음 한 번

`.codex/agents`나 `.codex/config.toml`을 수정한 뒤에는 새 Codex 세션을 열거나 Codex 앱/CLI를 재시작한다. 기존 세션은 agent 목록을 캐시하고 있을 수 있다.

## Claude `/tr`처럼 구현 작업

Codex 입력창에 `.codex/prompts/tr.md` 내용을 붙이고, 마지막 `작업:` 아래에 요청을 적는다.

```text
<.codex/prompts/tr.md 내용>

작업:
timeline feature에 클립 드래그 이동을 추가해줘. project.json 스키마가 바뀌면 docs/api/ 갱신까지 포함해줘.
```

## Claude `/rs`처럼 조사만

`.codex/prompts/rs.md` 내용을 붙이고 조사 대상을 적는다. 파일 수정 없이 읽기 전용으로 검증시키고 싶을 때 쓴다.

```text
<.codex/prompts/rs.md 내용>

조사 대상:
렌더러의 생성 요청 payload와 service/app/api/routes.py 계약이 일치하는지 파일 기준으로 추적해줘.
```

## Claude `/sw`처럼 작은 작업

`.codex/prompts/sw.md` 내용을 붙이고 작은 수정 요청을 적는다.

## 자연어 요청 예시

```text
AGENTS.md 기준으로 진행해줘. AI 서비스 변경이면 mm_mapper, mm_ai_worker, mm_reviewer 순서로 subagent를 써줘. 작업: ...
```

## 주의

- subagent를 쓰려면 "subagent를 써줘", "agent로 나눠서 해줘"처럼 명시하는 편이 가장 안정적이다.
- 구현은 한 agent만 파일을 쓰게 한다. 여러 worker가 같은 파일을 동시에 수정하면 충돌 위험이 커진다.
- renderer↔service 계약이 걸린 변경은 한쪽만 고치지 않는다.
- FE 기본 검증은 `npm run typecheck`와 `npm run lint`, 서비스는 Python import/syntax 확인이다.
- UI 변경은 가능한 경우 `npm run dev`로 실행 확인까지 수행한다.
- 시크릿·토큰·모델 계정 정보는 문서, 코드, 로그에 기록하지 않는다.
