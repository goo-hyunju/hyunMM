# hyunMM 작업 안내

- `git push`, `git revert`, `git reset --hard` 등 복구가 어렵거나 외부에 영향을 주는 Git 작업은 수행하지 않는다.
- 커밋은 사용자가 명시 요청했을 때만 한다. version bump와 커밋 메시지 형식은 전역 규칙(`version X.Y.Z, 작업내용`)을 따른다.

## 프로젝트 정체성

hyunMM은 **AI DAW**다. 사람이 DAW로 음악을 조작하면 AI가 프로젝트 맥락을 이해하고 클립 단위로 함께 편곡·생성한다. "프롬프트 → 완성곡" 생성기가 아니다. 기능 추가·설계 판단 시 이 정의를 기준으로 한다. 상세는 `CLAUDE.md`와 `docs/planning/product-plan.md`.

## 경계 분석 (Renderer / Electron / Python 서비스)

세 계층이 함께 영향을 받는 요청은 구현 전에 항상 경계를 먼저 정리한다.

- **Renderer(React + Web Audio)**: UI, 실시간 오디오 재생·믹싱·이펙트, 클라이언트 상태. 저지연이 필요한 것은 전부 여기.
- **Electron main**: 창, Python 서비스 프로세스 생명주기, 파일시스템 IO(프로젝트 저장/로드). 도메인 로직 금지.
- **Python 서비스**: AI 생성(오디오/MIDI), 오디오 분석, 모델 관리. 느린 비동기 작업 전담.

API payload, WebSocket 메시지, `project.json` 스키마가 바뀌는 변경은 renderer 타입 + service 스키마 + `docs/api/` 문서를 **같은 커밋에서** 갱신한다. 한쪽만 고치지 않는다.

## 검증

- FE 기본 검증: `npm run typecheck`, `npm run lint`. 변경 범위에 따라 `npm test`, `npm run build`.
- 서비스 기본 검증: Python import/syntax 확인, 관련 테스트.
- UI 변경은 가능하면 `npm run dev`로 실제 화면 확인까지. 확인 못 했으면 "미확인"으로 보고한다.
- 오디오 동작(재생, 레이턴시, 글리치)은 자동 테스트로 못 잡는 영역이 많다. 실제 재생 확인이 필요한 변경은 그 사실을 보고에 명시한다.

## 보안·저작권

- 시크릿·토큰·API key를 코드에 하드코딩하지 않는다. `.env`는 커밋하지 않는다.
- AI 모델 체크포인트, 학습 데이터, 사용자 프로젝트 파일(`projects/`)은 커밋하지 않는다.
- 학습·생성에 쓰는 데이터셋과 모델의 라이선스(상업적 사용 가능 여부)를 도입 전에 확인하고 `docs/`에 기록한다.

## 프로토타입·신규 기능 착수

- 새 feature를 만들기 전에 기존 `renderer/src/features/`와 `_shared` 성격의 코드를 먼저 검색한다. 있는 것을 확장하고, 없을 때만 만든다.
- 요청 범위 밖 리팩터링은 임의로 시작하지 않는다. 제안 후 승인을 받는다.
