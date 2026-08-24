// Python AI 서비스(HTTP/WS) 클라이언트. 계약은 docs/api/ 에 정의한다.

const FALLBACK_SERVICE_URL = 'http://127.0.0.1:8930';

export function getServiceUrl(): string {
	return window.hyunmm?.serviceUrl ?? FALLBACK_SERVICE_URL;
}

export async function pingService(): Promise<boolean> {
	try {
		const res = await fetch(`${getServiceUrl()}/health`);
		return res.ok;
	} catch {
		return false;
	}
}
