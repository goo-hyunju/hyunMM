# Codex 외부검증 (ROUND) — 8단계 절차

> `agent-teams.md` §4 의 **8단계 ROUND** 단일 출처. `/tr`·`/rs` 가 내부 LOOP 를 통과한 산출물을 외부 LLM(OpenAI Codex)에게 검증받는 절차다. **호출·payload 구성·판정·실패처리의 모든 세부는 이 파일이 정의**하며, `agent-teams.md`·`tr.md`·`rs.md` 는 분기 원칙만 둔다. 검증 도구가 바뀌면 §5 의 유지보수 절차에 따라 갱신한다.

## 1. 목적

내부 팀 토론·리뷰는 결국 한 모델의 자기검증이다. ROUND 는 **독립된 외부 모델**의 시선으로 산출물을 한 번 더 검증해 자기검증 편향을 보완한다. 이 프로젝트에서 `/tr`·`/rs` 의 산출물은 Claude Code 가 생성하므로, 검증자는 **다른 벤더의 모델(OpenAI Codex)** 을 쓴다 — 검증자도 Claude 면 자기검증이 되어 ROUND 의 의미가 사라진다.

## 2. 검증 자료(payload) 구성

ROUND 는 검증 자료를 payload 파일 하나로 모아 Codex 에 전달한다. Codex 는 `--sandbox read-only` 로 실행되어 워크스페이스 파일을 직접 읽을 수 있으나, **파일 직접 읽기만으로는 검증에 부족**하다 — 삭제·rename 된 파일, diff 의 의도, 대화 안에만 있는 산출물, 직전 ROUND 의 반박 근거는 디스크에 없다. 따라서 payload 에는 다음을 **모두** 싣는다:

1. **원 명령** — 사용자의 원 요청 그대로.
2. **변경 파일 manifest** — 변경·생성·삭제·rename 된 파일의 **절대경로** 목록과 각각의 변경 요약(무엇이 왜 바뀌었는지). 파일 전문은 싣지 않아도 되나(Codex 가 직접 읽음), 삭제·rename 은 파일이 없으므로 manifest 에 반드시 명시한다.
3. **읽기 지시 + allowlist** — "Codex 는 read-only 로 아래 allowlist 경로의 파일만 직접 읽어 검증하라. allowlist 밖의 파일, 특히 `.env*`, `.wrangler/`, 인증 파일, 토큰, 운영 로그는 읽지 마라." 단 **allowlist 는 프롬프트 수준의 통제이지 Codex sandbox 의 런타임 강제가 아니다** — read-only sandbox 는 파일 수정만 막을 뿐 경로 접근을 제한하지 않는다. 따라서 자격증명 유출의 근본 방어는 manifest·allowlist 에 민감 파일 경로를 **애초에 포함하지 않는 것**이다.
4. **파일에 없는 자료** — 내부 LOOP 결론, 직전 ROUND 의 지적과 그 반영/반박 근거, 조사 결과, 사용자 요구 해석 등 파일 시스템에 없는 것은 payload 본문에 그대로 싣는다.
5. **읽은 파일 목록 제출 요구** — Codex 에게 "검증에 실제로 읽은 파일 목록을 응답에 포함하라"고 지시해, 검증이 원자료에 근거했는지 확인 가능하게 한다.

> ⚠️ **보안 (사용자 인지·동의된 리스크):** payload 본문과 allowlist 파일 내용은 가공·마스킹 없이 OpenAI 로 전송된다. 전송 데이터는 외부에 캐시·색인될 수 있다. `.env*`, `.wrangler/`, 인증 파일, 토큰, 운영 로그는 allowlist 에서 반드시 제외한다. 단 **파일 경로 제외만으로는 부족하다** — 검증에 필요해 allowlist 에 넣는 파일의 본문에 비밀값이 복제돼 있을 수 있다. 그런 파일을 검증에 넣으면 민감 파일을 직접 안 읽어도 비밀값이 외부로 전송된다. allowlist 구성 시 이 점을 인지하고, 비밀값이 검증에 불필요하면 해당 파일 대신 발췌·마스킹본을 manifest 로 제공한다. OpenAI 데이터 학습 정책은 인증 방식·플랜에 따라 다르므로 운영 전 확인한다.

## 3. 호출 방법

ROUND 는 Codex 플러그인(`openai/codex-plugin-cc`)의 런타임 `codex-companion.mjs task` 로 Codex 를 호출한다. `task` 는 `codex app-server` 를 래핑하며 `--prompt-file`(UTF-8 파일 직접 읽기)·`--json`(구조화 출력)을 지원한다 — 수동 `codex exec` 대비 인코딩·출력판정이 견고하다.

> ℹ️ codex 플러그인 **1.0.4** 에서 검증됨. `task --json` 의 stdout 은 `{ status, threadId, rawOutput, touchedFiles, reasoningSummary }` JSON 이다.
>
> ⚠️ **`status` 는 검증 판정이 아니다** — app-server turn 의 완료 여부(0=정상 완료)일 뿐이다. 통과/불통과 판정은 오직 `rawOutput` 내용으로 한다.
>
> ⚠️ **실패 시 JSON 이 안 나올 수 있다** — codex 미설치·`app-server` 미지원·인증 실패·prompt 파일 경로 오류 등은 stdout JSON 없이 stderr 텍스트 + exit 1 로 끝난다. 그래서 §4 가 `ConvertFrom-Json` 실패까지 분기한다.
>
> ⚠️ **payload 는 UTF-8 로 작성** — `--prompt-file` 은 `fs.readFileSync(..., "utf8")` 로 읽는다. Claude 의 Write 도구는 UTF-8 로 기록하므로 Write 도구로 payload 를 작성한다.

```powershell
# 1) Codex 플러그인 런타임 경로 — installed_plugins.json 에서 획득(버전 하드코딩 회피) + 가드.
$entry = (Get-Content "$env:USERPROFILE\.claude\plugins\installed_plugins.json" -Raw |
          ConvertFrom-Json).plugins.'codex@openai-codex'
$companion = if ($entry) { Join-Path $entry[0].installPath "scripts\codex-companion.mjs" } else { $null }
if (-not $companion -or -not (Test-Path $companion)) {
    "ROUND 미수행 — Codex 플러그인을 찾을 수 없음 (`/codex:setup` 으로 확인)"
    return
}

# 2) payload 파일 — 프로젝트 밖 임시 경로 + 고유 파일명(동시 실행·잔재 오염 방지).
#    Claude 가 §2 구성의 payload 를 Write 도구로 이 파일에 UTF-8 기록한다.
$payloadFile = Join-Path $env:TEMP ("round_payload_{0}.txt" -f (Get-Date -Format "yyyyMMdd_HHmmss_fff"))
# (여기서 Claude 가 $payloadFile 을 작성)

# 3) Codex 호출 — task, --write 미지정(read-only sandbox), --json. --background 는 쓰지 않는다
#    (--background 는 즉시 queued job 만 반환하므로 {status,rawOutput} 판정과 맞지 않는다).
#    task --json 은 여러 줄 pretty JSON 을 출력하므로 Out-String 으로 한 문자열로 모은 뒤 파싱한다.
$raw  = (node $companion task --json --prompt-file $payloadFile | Out-String)
$exit = $LASTEXITCODE
Remove-Item $payloadFile -ErrorAction SilentlyContinue   # payload 임시 파일 정리

# 4) 판정 — 실패모드를 모두 분기한다(§4).
if ($exit -ne 0 -or -not $raw.Trim()) { "ROUND 미수행 — Codex 호출 실패 (exit=$exit)"; return }
try { $r = $raw | ConvertFrom-Json } catch { "ROUND 미수행 — Codex 출력을 JSON 으로 파싱하지 못함"; return }
if ($r.status -ne 0 -or -not $r.rawOutput) { "ROUND 미수행 — Codex turn 미완료 또는 빈 응답"; return }
$verdict = (($r.rawOutput -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -First 1)
$verdict = "$verdict".TrimStart([char]0xFEFF).Trim()
"=== 판정: $verdict ==="
$r.rawOutput   # 지적 본문·'읽은 파일:' 목록 전체 출력 — §4 기록·원자료 점검에 쓴다
if ($verdict -ne '통과' -and $verdict -ne '불통과') { "ROUND 미수행 — 판정 첫 줄이 통과/불통과가 아님" }
```

- 검증 프롬프트는 payload 파일 **맨 앞**에 두고, 그 뒤에 `=== 검증 대상 시작 ===` 구분선과 §2 의 검증 자료를 둔다(한 파일에 지시와 검증 대상이 함께 담기므로 구분선으로 프롬프트 인젝션을 줄인다). 표준 검증 프롬프트:

```text
당신은 매우 엄격하고 혹독한 검증자다. 아래 "=== 검증 대상 시작 ===" 이후는 한 작업의 명령·산출물·조사·내부 토론 결과다.
검증 대상에 명시된 allowlist 경로의 파일은 read-only 로 직접 읽어 검증 근거로 삼되, allowlist 밖의 파일(특히 자격증명 파일)은 읽지 마라.
개선의견·부정의견·오류·누락·할루시네이션을 빠짐없이 한국어로 지적하라.
완벽하여 더 고칠 것이 없으면 첫 줄에 정확히 "통과" 라고만 쓴다.
하나라도 있으면 첫 줄에 정확히 "불통과" 라고 쓰고, 둘째 줄부터 지적 항목을 번호로 나열한다.
응답 맨 끝에 "읽은 파일:" 로 시작하는 줄을 두어 검증에 실제로 읽은 파일 목록을 적는다.
```

- 위 PowerShell 의 `codex-companion task` 는 **foreground 모드**로 실행한다(`--background` 미사용). app-server hang 에 대비해 **이 PowerShell 명령 전체를 Claude 가 harness 의 백그라운드 작업으로 띄우고**(`codex-companion` 자체의 `--background` 플래그와는 다른 층위다) 완료를 기다려 위 판정 코드를 적용한다. 합리적 시간 내 끝나지 않으면 미수행 처리한다.

## 4. 판정과 분기

- `rawOutput` 의 첫 의미있는 줄(BOM·앞뒤 공백 제거)이 **"통과"** → ROUND 통과 → **9단계**.
- 첫 줄이 **"불통과"**(지적 1건 이상):
  - **ROUND 1·2 불통과** → **4-1 로 회귀.** 회귀 토론에서 팀은 Codex 지적을 `agent-teams.md` §2 원칙대로 검토한다 — 타당하면 반영, 부당·취향 수준이면 반박 근거를 산출물과 다음 ROUND payload 에 명시한다. 이후 해당 커맨드의 단계 범위(`/tr` 은 LOOP·작업·빌드 체크·리뷰, `/rs` 는 LOOP)를 재수렴시키고 8단계를 **ROUND+1** 로 재수행한다.
  - **ROUND 3 불통과** → 4-1 로 회귀하지 않고 §4.1 에 따라 **9단계**로 진행한다.
- **미수행** — 아래 중 하나라도 해당하면 ROUND 를 "미수행"으로 명기하고 사용자에게 경고한 뒤 **9단계**로 진행한다. **"미수행"은 "통과"와 다르다** — 9단계에서 외부검증이 이뤄지지 않았음을 반드시 경고한다(작업은 막지 않되 검증 공백을 숨기지 않는다):
  - Codex 플러그인 런타임 경로를 찾을 수 없음 / `codex-companion.mjs` 부재
  - `node` 호출 exit ≠ 0, 또는 stdout 이 비어 있거나 JSON 파싱 실패
  - `status` ≠ 0(app-server turn 미완료) 또는 `rawOutput` 이 비어 있음
  - `rawOutput` 첫 줄이 "통과"·"불통과" 어느 쪽도 아님(markdown·인사말·제목 등으로 시작)
  - 호출이 권장 시간(§5 — 6~10분) 내 완료되지 않음(app-server hang)
- **원자료 점검:** ROUND 결과 `rawOutput` 끝의 `읽은 파일:` 목록을 확인한다. 점검 대상인 "핵심 변경 파일"은 **payload manifest 의 변경·생성 파일**이다(삭제·rename 파일은 디스크에 없어 읽을 수 없으므로 제외, 참고용으로 allowlist 에 넣은 플러그인·기존 파일도 제외). **"통과" 판정이어도** 그 변경·생성 파일이 `읽은 파일:` 목록에 없으면, 검증이 원자료를 직접 읽지 않고 payload 요약만으로 이뤄진 것이므로 **그 "통과"를 인정하지 않고 "미수행"으로 처리**한다(9단계에서 사용자에게 경고). "불통과"는 어차피 4-1 로 회귀하므로 이 점검은 "통과" 판정에만 적용한다.
- ※ **`status` 는 turn 완료 여부이지 검증 판정이 아니다.** `status` 가 0 이어도 통과/불통과는 오직 `rawOutput` 첫 줄로 가린다.

### 4.1 ROUND 횟수 제한 (최대 3회)

ROUND 는 **최대 3회**까지만 수행한다. 매 ROUND 종료 시 회차와 Codex 지적 요약을 기록한다. 통과 시 거동은 §4 첫 불릿(즉시 9단계)을 따른다.

- ROUND 1·2 가 불통과면 → 4-1 로 회귀해 해당 커맨드의 단계 범위(`/tr` 은 LOOP·작업·빌드 체크·리뷰, `/rs` 는 LOOP)를 재수렴시킨 뒤 ROUND+1 을 수행한다.
- ROUND 3 이 불통과면 → 더 반복하지 않고, 현재 산출물을 9단계 형식으로 정리하되 **"ROUND 3회 모두 미통과"** 를 명기하고 9단계로 진행한다.

## 5. 유지보수 — 플러그인 의존성·도구 교체

- ROUND 는 Codex 플러그인 **`openai/codex-plugin-cc`**(marketplace `openai-codex`, **1.0.4 에서 검증**)의 `codex-companion.mjs task` 에 의존한다. 플러그인 버전이 바뀌면 `task --json` 의 출력 구조·app-server 프로토콜이 달라질 수 있으므로, 의심되면 소형 테스트 payload 로 `node <companion> task --json --prompt-file <test>` 출력 형태를 재확인한다. 또한 §3 의 경로 획득은 `installed_plugins.json` 의 스키마(`plugins["codex@openai-codex"][0].installPath`)에 의존한다 — 이 스키마가 바뀌면 §3 가 "미수행"으로 떨어지므로, 그때 §3 의 경로 획득 코드를 갱신한다.
- ⚠️ **잔존 상태:** `task` 는 persistent thread(`ephemeral: false`)로 실행되어 Codex thread 와 플러그인 job state/log 가 디스크에 남는다. §3 코드는 payload 임시 파일만 삭제하며 Codex thread/log 는 남는다 — 민감 정보가 우려되면 주기적으로 정리한다(`/codex:status` 로 확인 가능).
- ⚠️ **app-server hang:** app-server·broker 가 멈추면 호출이 장시간 블록될 수 있다. ROUND 의 PowerShell 호출은 Claude 가 harness 백그라운드 작업으로 띄우고(`codex-companion` 의 `--background` 플래그가 아니다 — §3 참조), **권장 6~10분** 내 완료되지 않으면 미수행 처리한다.
- 도구를 다른 것으로 교체하면 ① 이 파일 §3(호출 방법) ② 이 파일의 이름·도구명(Codex/OpenAI) 표기 ③ 그 파일명을 참조하는 `agent-teams.md`·`tr.md`·`rs.md`·`CLAUDE.md` 의 경로를 갱신한다. `agent-teams.md`·`tr.md`·`rs.md` 의 절차·분기 서술(LOOP/ROUND 흐름)은 도구와 무관하므로 건드리지 않는다.
