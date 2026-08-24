import type { PreloadApi } from '../../../app/preload/index';

declare global {
	interface Window {
		// preload(contextBridge)가 노출. 브라우저 단독 실행 시에는 없을 수 있다.
		hyunmm?: PreloadApi;
	}
}

export {};
