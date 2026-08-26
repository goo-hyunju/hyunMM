import { contextBridge, ipcRenderer } from 'electron';
import { SERVICE_PORT } from '../shared/servicePort';

// 렌더러에 노출하는 최소 API. 프로젝트 저장/로드 IPC는 구현 시 여기에 추가한다.
const api = {
	platform: process.platform,
	// HYUNMM_SERVICE_URL: 원격 AI 서버 모드 — 다른 PC의 서비스를 쓸 때 설정한다 (README 참조)
	serviceUrl: process.env['HYUNMM_SERVICE_URL'] ?? `http://127.0.0.1:${SERVICE_PORT}`,
	// 수락된 생성 클립 미디어를 projects/<이름>/audio|midi/ 에 저장 (docs/api/generation.md)
	saveClipMedia: (projectName: string, relPath: string, bytes: ArrayBuffer): Promise<void> =>
		ipcRenderer.invoke('project:saveClipMedia', projectName, relPath, bytes) as Promise<void>,
};

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld('hyunmm', api);
