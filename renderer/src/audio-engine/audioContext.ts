// Web Audio 엔진의 단일 AudioContext. 사용자 제스처 이후 resume 해야 한다.
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
	if (!ctx) {
		ctx = new AudioContext({ latencyHint: 'interactive' });
	}
	return ctx;
}
