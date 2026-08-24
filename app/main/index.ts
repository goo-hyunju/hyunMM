import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

// service/app/main.py 의 SERVICE_PORT 와 같은 값을 유지한다
export const SERVICE_PORT = 8930;

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
		},
	});

	if (process.env['ELECTRON_RENDERER_URL']) {
		void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
	} else {
		void win.loadFile(join(__dirname, '../renderer/index.html'));
	}
}

app.whenReady().then(() => {
	spawnAiService();
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
