// 생성 job 상태 훅 — 소비자가 AiCopilotPanel 하나라 feature 로컬로 둔다.
// 타임라인이 "생성 중 고스트 클립"을 그리게 되면 store로 승격한다(승격 트리거 명시).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	cancelJob,
	fetchJobResult,
	getJob,
	openJobSocket,
	postGenerate,
	ServiceHttpError,
} from '../../app/serviceClient';
import type {
	GenerateRequest,
	GenerateResult,
	GenerationStage,
	JobWsMessage,
} from '../../app/types/serviceContract';

const POLL_INTERVAL_MS = 1000; // WS 단절 시 getJob 폴백 주기

export type GenerationPhase =
	| { name: 'idle' }
	| { name: 'requesting' }
	| { name: 'generating'; jobId: string; stage: GenerationStage; progress?: number }
	| { name: 'succeeded'; jobId: string; result: GenerateResult; bytes: ArrayBuffer }
	| { name: 'failed'; error: string }
	| { name: 'cancelled' };

function toUserMessage(e: unknown): string {
	if (e instanceof ServiceHttpError) return e.detail?.message ?? e.message;
	if (e instanceof Error) return e.message;
	return '알 수 없는 오류';
}

export function useGenerationJob() {
	const [phase, setPhase] = useState<GenerationPhase>({ name: 'idle' });
	const cleanupRef = useRef<(() => void) | null>(null); // WS close 또는 폴링 clear

	const finalizeSucceeded = useCallback(async (jobId: string, result: GenerateResult) => {
		try {
			const bytes = await fetchJobResult(jobId);
			setPhase({ name: 'succeeded', jobId, result, bytes });
		} catch (e) {
			setPhase({ name: 'failed', error: toUserMessage(e) });
		}
	}, []);

	const handleMessage = useCallback(
		(jobId: string, m: JobWsMessage) => {
			if (m.type === 'progress') {
				setPhase({ name: 'generating', jobId, stage: m.stage, progress: m.progress });
				return;
			}
			cleanupRef.current?.();
			cleanupRef.current = null;
			if (m.type === 'succeeded') void finalizeSucceeded(jobId, m.result);
			else if (m.type === 'failed') setPhase({ name: 'failed', error: m.error.message });
			else setPhase({ name: 'cancelled' });
		},
		[finalizeSucceeded]
	);

	const startPolling = useCallback(
		(jobId: string) => {
			// setTimeout 재귀 체인 — setInterval의 중첩 요청과 out-of-order 응답이
			// 종료 상태(최종)를 되돌리는 레이스를 구조적으로 제거한다.
			let finished = false;
			let timer = 0;
			const tick = async () => {
				if (finished) return;
				try {
					const job = await getJob(jobId);
					if (finished) return;
					if (job.status === 'queued' || job.status === 'running') {
						setPhase({
							name: 'generating',
							jobId,
							stage: job.stage ?? 'queued',
							progress: job.progress,
						});
						timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
						return;
					}
					finished = true;
					cleanupRef.current = null;
					if (job.status === 'succeeded' && job.result) {
						void finalizeSucceeded(jobId, job.result);
					} else if (job.status === 'failed') {
						setPhase({ name: 'failed', error: job.error?.message ?? '생성 실패' });
					} else {
						setPhase({ name: 'cancelled' });
					}
				} catch (e) {
					if (finished) return;
					finished = true;
					cleanupRef.current = null;
					setPhase({ name: 'failed', error: toUserMessage(e) });
				}
			};
			timer = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
			cleanupRef.current = () => {
				finished = true;
				window.clearTimeout(timer);
			};
		},
		[finalizeSucceeded]
	);

	const start = useCallback(
		async (req: GenerateRequest) => {
			setPhase({ name: 'requesting' });
			try {
				const job = await postGenerate(req);
				setPhase({ name: 'generating', jobId: job.jobId, stage: job.stage ?? 'queued' });
				cleanupRef.current = openJobSocket(
					job.jobId,
					(m) => handleMessage(job.jobId, m),
					() => startPolling(job.jobId) // WS 단절 → 폴링 폴백 (단절 ≠ 취소)
				);
			} catch (e) {
				setPhase({ name: 'failed', error: toUserMessage(e) });
			}
		},
		[handleMessage, startPolling]
	);

	const cancel = useCallback(async (jobId: string) => {
		try {
			await cancelJob(jobId); // 멱등 — 최종 상태는 WS/폴링 메시지가 진실
		} catch (e) {
			setPhase({ name: 'failed', error: toUserMessage(e) });
		}
	}, []);

	const reset = useCallback(() => {
		cleanupRef.current?.();
		cleanupRef.current = null;
		setPhase({ name: 'idle' });
	}, []);

	// unmount: 소켓/타이머만 정리 — 서버 job은 죽이지 않는다 (계약: WS 단절 ≠ 취소)
	useEffect(() => () => cleanupRef.current?.(), []);

	return { phase, start, cancel, reset };
}
