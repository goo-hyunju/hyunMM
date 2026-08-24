import { contextBridge } from 'electron';

// 렌더러에 노출하는 최소 API. 프로젝트 저장/로드 IPC는 구현 시 여기에 추가한다.
const api = {
	platform: process.platform,
	serviceUrl: 'http://127.0.0.1:8930',
};

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld('hyunmm', api);
