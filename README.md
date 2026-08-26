# hyunMM

AI DAW — 사람이 DAW로 음악을 조작하면 AI가 프로젝트 맥락(트랙·클립·BPM·키)을 이해하고 함께 편곡·생성하는 데스크톱 앱.

- **Electron + React 19 + Web Audio** — DAW 본체. 재생·믹싱 등 실시간 오디오는 렌더러에서 처리한다(저지연).
- **Python FastAPI 서비스** (`service/`, 포트 **8930**) — AI 생성(오디오/MIDI)·분석. 앱이 자동으로 띄우고 HTTP/WS로 통신한다.
- 저장은 DB 없이 로컬 프로젝트 파일(`projects/<이름>/project.json` + 미디어 폴더).

구조·원리 상세는 `hyunMM_구조_문서.html`, 개발 규칙은 `CLAUDE.md` 참조.

---

## 1. 새 PC에서 처음 실행하기

### 요구사항

| 도구 | 버전 | 확인 |
|---|---|---|
| Node.js | 22+ | `node -v` |
| Python | 3.11+ | `python --version` |
| Git | — | `git --version` |

### 셋업 (Windows PowerShell 기준)

```powershell
git clone <저장소 URL> hyunMM
cd hyunMM

# 1) Node 의존성
npm install

# 2) Python 서비스 가상환경 (경로가 service\.venv 여야 앱이 찾는다)
cd service
python -m venv .venv
.venv\Scripts\pip install -e .
cd ..

# 3) 실행 — 앱 창이 뜨고 Python 서비스(8930)도 자동으로 함께 뜬다
npm run dev
```

macOS/Linux는 `.venv/Scripts/` 대신 `.venv/bin/` 을 쓰면 된다 (`.venv/bin/pip install -e .`).

> **venv 경로 주의:** Electron이 `service/.venv/Scripts/uvicorn.exe`(win32) 경로를 직접 실행한다
> (`app/main/index.ts` 의 `spawnAiService`). venv를 다른 이름·위치에 만들면 서비스가 안 뜬다.

### AI(생성) 기능까지 쓰려면

기본 설치(위 2번)는 **mock 생성기**로 동작한다 — 생성 요청→진행률→결과 흐름 전체가 실제로 돌지만, 결과물은 합성 톤 WAV/MIDI다. 실제 AI 모델 추론용 의존성(torch 등, 수 GB)은 선택 설치다:

```powershell
cd service
.venv\Scripts\pip install -e ".[ai]"
```

GPU가 없거나 사양이 낮은 PC는 이 단계를 건너뛰고 아래 **원격 AI 서버 모드**를 쓰면 된다.

### AI가 안 떠도 괜찮다

서비스 spawn이 실패해도 앱은 죽지 않는다 — **DAW 본체는 그대로 동작하고 AI 기능만 비활성**이 된다
(`app/main/index.ts` 의 `serviceProcess.on('error')` 처리). Python이 아예 없는 PC에서도 DAW로는 쓸 수 있다.

---

## 2. 원격 AI 서버 모드 — 다른 PC의 AI를 빌려 쓰기

AI를 돌릴 수 없는 PC(클라이언트)에서, AI가 도는 PC(서버)를 켜두고 그쪽 서비스에 접속하는 구성.

```
[클라이언트 PC]                         [서버 PC (이 PC)]
hyunMM 앱 (DAW 본체)  ──HTTP/WS──▶  Python AI 서비스 (0.0.0.0:8930)
로컬 서비스는 띄우지 않음               npm run service:serve
```

### 서버 PC (AI가 도는 쪽)

```powershell
# 1) 서비스만 외부 접속 허용으로 실행 (0.0.0.0 바인딩)
npm run service:serve

# 2) 이 PC의 LAN IP 확인 (예: 192.168.0.10)
ipconfig
```

Windows 방화벽이 첫 실행 때 허용 여부를 물으면 **개인 네트워크 허용**. 프롬프트가 안 떴거나 접속이 막히면 수동으로 연다 (관리자 PowerShell):

```powershell
netsh advfirewall firewall add rule name="hyunMM AI Service" dir=in action=allow protocol=TCP localport=8930
```

### 클라이언트 PC (DAW를 쓰는 쪽)

셋업 1번(git clone + `npm install`)까지만 하면 된다. **Python venv 불필요.** 환경변수로 서버 주소를 주고 실행한다:

```powershell
$env:HYUNMM_SERVICE_URL = "http://192.168.0.10:8930"   # 서버 PC의 IP
npm run dev
```

`HYUNMM_SERVICE_URL` 이 설정되면 앱은 로컬 Python 서비스를 띄우지 않고 해당 주소로 접속한다. 해제하려면 새 터미널에서 실행하거나 `Remove-Item Env:HYUNMM_SERVICE_URL`.

연결 확인: 클라이언트 PC 브라우저에서 `http://<서버IP>:8930/health` 가 `{"status":"ok"}` 를 반환하면 정상.

### 인터넷 너머(외부)에서 접속하기 — Tailscale 권장

`HYUNMM_SERVICE_URL` 자체는 어떤 주소든 받는다. 문제는 보안이다 — 서비스에 인증이 없어서
**공유기 포트포워딩으로 8930을 인터넷에 직접 여는 것은 금지**다(주소를 아는 누구나, 포트 스캔 봇까지 접근 가능).

외부 접속은 [Tailscale](https://tailscale.com)(개인 무료)로 두 PC를 가상 LAN으로 묶는 방식을 쓴다.
포트포워딩·공인 IP 불필요, 트래픽 암호화, **본인 계정 기기만 접속 가능**하므로 인증 없는 현재 서비스로도 안전하다.

```powershell
# 서버 PC · 클라이언트 PC 양쪽: Tailscale 설치 후 같은 계정으로 로그인
# https://tailscale.com/download

# 서버 PC — 서비스 실행은 동일 (0.0.0.0 바인딩이 Tailscale 인터페이스도 포함한다)
npm run service:serve
tailscale ip -4        # Tailscale IP 확인 (예: 100.101.102.103)

# 클라이언트 PC — Tailscale IP로 접속
$env:HYUNMM_SERVICE_URL = "http://100.101.102.103:8930"
npm run dev
```

방화벽 규칙(위 netsh)은 동일하게 필요하다. 연결 확인도 동일: 브라우저에서 `http://<Tailscale IP>:8930/health`.

### 제약·주의

- **포트를 인터넷에 직접 노출하지 말 것.** LAN 밖 접속은 반드시 Tailscale 같은 VPN 경유. 공개 노출이 꼭 필요해지면 서비스에 API key 인증부터 구현해야 한다(현재 미구현).
- 동시 생성은 서버 전체에서 **1개**다. 여러 명이 붙으면 두 번째 요청부터 `409 SERVICE_BUSY` 를 받는다 (`service/app/api/jobs.py`).
- 생성 결과 파일은 서버 PC의 `service/staging/` 에 쌓인다. 클라이언트는 HTTP로 바이트를 받아가므로 동작에는 문제없지만, 서버 디스크는 주기적으로 비워야 한다(자동 정리 미구현).
- 서버 PC가 절전 모드로 들어가면 끊긴다. 전원 옵션에서 절전을 꺼둘 것.

---

## 3. 명령어

```bash
npm run dev            # 앱 전체 기동 (main/preload/renderer + 서비스 spawn). 평소 개발은 이것 하나
npm run service:dev    # Python 서비스만 단독 실행 (127.0.0.1, --reload) — API 작업용
npm run service:serve  # Python 서비스를 외부 접속 허용(0.0.0.0)으로 실행 — 원격 AI 서버 모드용
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm test               # vitest run
npm run build          # typecheck + electron-vite build
```

- `npm run dev` 와 `service:dev`/`service:serve` 를 같은 PC에서 동시에 실행하면 포트 8930 충돌.
- 서비스 포트 **8930** 은 `app/shared/servicePort.ts` 와 `service/app/main.py` 양쪽에 상수로 존재한다. 바꾸면 둘 다 바꾼다.

## 4. 배포 관련 현황

설치 파일(더블클릭 실행) 패키징은 아직 없다 — 실행은 위의 개발 모드(`npm run dev`)가 유일하다.
패키징하려면 electron-builder 도입 + Python 런타임 번들링(`app/main/index.ts` 의 spawn 경로 교체)이 필요하다.
