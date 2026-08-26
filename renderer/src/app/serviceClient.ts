// Python AI 서비스(HTTP/WS) 클라이언트. 계약은 docs/api/generation.md 에 정의한다.

import type {
	CancelResponse,
	GenerateJob,
	GenerateRequest,
	JobWsMessage,
	ServiceError,
} from './types/serviceContract';

import { SERVICE_PORT } from '../../../app/shared/servicePort';

// 브라우저 단독 실행(preload 부재) 폴백
const FALLBACK_SERVICE_URL = `http://127.0.0.1:${SERVICE_PORT}`;

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

export class ServiceHttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly detail: ServiceError | null, // 구조화 detail 봉투가 있을 때만
		message: string
	) {
		super(message);
		this.name = 'ServiceHttpError';
	}
}

function isServiceError(v: unknown): v is ServiceError {
	return (
		typeof v === 'object' &&
		v !== null &&
		typeof (v as ServiceError).code === 'string' &&
		typeof (v as ServiceError).message === 'string'
	);
}

async function throwHttpError(res: Response): Promise<never> {
	let detail: ServiceError | null = null;
	let message = `HTTP ${res.status}`;
	try {
		const body: unknown = await res.json();
		const d = (body as { detail?: unknown }).detail;
		if (isServiceError(d)) {
			detail = d;
			message = d.message;
		} else if (typeof d === 'string') {
			message = d;
		}
	} catch {
		// 본문이 JSON이 아니면 status 메시지만 유지
	}
	throw new ServiceHttpError(res.status, detail, message);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${getServiceUrl()}${path}`, init);
	if (!res.ok) await throwHttpError(res);
	return (await res.json()) as T;
}

export function postGenerate(req: GenerateRequest): Promise<GenerateJob> {
	return requestJson<GenerateJob>('/generate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(req),
	});
}

export function getJob(jobId: string): Promise<GenerateJob> {
	return requestJson<GenerateJob>(`/jobs/${jobId}`);
}

export async function fetchJobResult(jobId: string): Promise<ArrayBuffer> {
	const res = await fetch(`${getServiceUrl()}/jobs/${jobId}/result`);
	if (!res.ok) await throwHttpError(res);
	return res.arrayBuffer();
}

export function cancelJob(jobId: string): Promise<CancelResponse> {
	return requestJson<CancelResponse>(`/jobs/${jobId}/cancel`, { method: 'POST' });
}

// 반환값은 close 함수. 재연결 없음 — 단절 시 호출측이 onDisconnect에서 getJob 폴링으로 폴백한다.
export function openJobSocket(
	jobId: string,
	onMessage: (m: JobWsMessage) => void,
	onDisconnect?: () => void // 호출측 close 이전의 단절(서버 정상 종료 포함)에서 호출
): () => void {
	const wsUrl = getServiceUrl().replace(/^http/, 'ws');
	const ws = new WebSocket(`${wsUrl}/ws/jobs/${jobId}`);
	let closedByCaller = false;
	ws.onmessage = (ev) => {
		try {
			const m = JSON.parse(ev.data as string) as JobWsMessage;
			if (m.jobId === jobId) onMessage(m); // 타 job 메시지 방어
		} catch {
			// malformed frame 무시 — 단절 시 폴링이 보정한다
		}
	};
	ws.onclose = () => {
		if (!closedByCaller) onDisconnect?.();
	};
	return () => {
		closedByCaller = true;
		ws.close();
	};
}
