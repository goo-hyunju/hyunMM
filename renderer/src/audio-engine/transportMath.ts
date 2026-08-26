// transport 시간 계산 순수 함수 — AudioContext 무관, vitest 대상.
// 유일한 시계는 AudioContext.currentTime이며, 상태는 anchor 쌍 (ctxTime, beats) + bpm 뿐이다.

export const DEFAULT_BPM = 120;
export const MIN_BPM = 20;
export const MAX_BPM = 300;

/** anchor(ctxTime, beats) 기준 현재 beat 위치 */
export function positionBeatsAt(
	now: number,
	anchorCtxTime: number,
	anchorBeats: number,
	bpm: number
): number {
	return anchorBeats + (now - anchorCtxTime) * (bpm / 60);
}

/** beat → AudioContext 시간. 스케줄러(메트로놈, 이후 클립 재생)가 쓰는 역함수 */
export function ctxTimeAtBeat(
	beat: number,
	anchorCtxTime: number,
	anchorBeats: number,
	bpm: number
): number {
	return anchorCtxTime + (beat - anchorBeats) * (60 / bpm);
}

export function clampBpm(bpm: number): number {
	if (!Number.isFinite(bpm)) return DEFAULT_BPM;
	return Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
}
