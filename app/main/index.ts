import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { SERVICE_PORT } from '../shared/servicePort';

let serviceProcess: ChildProcess | null = null;

function spawnAiService(): void {
	// 개발 단계: service/.venv 의 uvicorn 을 직접 실행한다.
	// 패키징 시에는 번들된 Python 런타임 경로로 교체한다.
	const uvicorn =
		process.platform === 'win32'
			? join(app.getAppPath(), 'service', '.venv', 'Scripts', 'uvicorn.exe')
			: join(app.getAppPath(), 'service', '.venv', 'bin', 'uvicorn');

	serviceProcess = spawn(uvicorn, ['app.main:app', '--port', String(SERVICE_PORT)], {
		cwd: join(app.getAppPath(), 'service'),
		stdio: 'inherit',
	});

	serviceProcess.on('error', (err) => {
		// 서비스가 없어도 DAW 자체는 동작해야 한다. AI 기능만 비활성 상태가 된다.
		console.error('[ai-service] spawn failed:', err.message);
		serviceProcess = null;
	});
}

function createWindow(): void {
	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			nodeIntegration: false,
			// DAW 관행: 창 가림/최소화 시 타이머 스로틀링이 오디오 스케줄러(lookahead)를 끊지 않게
			backgroundThrottling: false,
		},
	});

	if (process.env['ELECTRON_RENDERER_URL']) {
		void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
	} else {
		void win.loadFile(join(__dirname, '../renderer/index.html'));
	}
}

// 수락된 생성 클립 미디어 저장 — 경로 탈출 3중 방어 (이름 검증 / relPath 검증 / prefix 재확인).
// TODO 패키징: app.getAppPath()는 asar 내부라 쓰기 불가 — uvicorn spawn 경로와 함께 이전한다.
function registerProjectIpc(): void {
	const projectsRoot = join(app.getAppPath(), 'projects');
	ipcMain.handle(
		'project:saveClipMedia',
		async (_ev, projectName: unknown, relPath: unknown, bytes: unknown) => {
			if (typeof projectName !== 'string' || typeof relPath !== 'string')
				throw new Error('saveClipMedia: 잘못된 인자');
			let data: Buffer;
			if (bytes instanceof ArrayBuffer) data = Buffer.from(new Uint8Array(bytes));
			else if (bytes instanceof Uint8Array) data = Buffer.from(bytes);
			else throw new Error('saveClipMedia: bytes 타입 오류');
			if (!/^[\w][\w .-]*$/.test(projectName)) throw new Error('잘못된 프로젝트 이름');
			if (!/^(audio|midi)\/[\w-]+\.(wav|mid)$/.test(relPath)) throw new Error('잘못된 미디어 경로');
			const abs = resolve(projectsRoot, projectName, relPath);
			if (!abs.startsWith(resolve(projectsRoot) + sep)) throw new Error('경로 탈출 차단');
			await mkdir(dirname(abs), { recursive: true });
			await writeFile(abs, data);
		}
	);
}

app.whenReady().then(() => {
	registerProjectIpc();
	// 원격 AI 서버 모드: 렌더러가 HYUNMM_SERVICE_URL 로 접속하므로 로컬 서비스를 띄우지 않는다
	if (!process.env['HYUNMM_SERVICE_URL']) spawnAiService();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
	serviceProcess?.kill();
	serviceProcess = null;
});
