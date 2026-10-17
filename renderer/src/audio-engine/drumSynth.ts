// 드럼 신스 — 샘플 없이 합성한다. 히트당 노드 생성은 Web Audio 1회용 노드 모델
// 그대로다(고빈도 루프 아님 — 사용자 입력 단위).

import { getAudioContext } from './audioContext';

export type DrumSound =
	'kick' | 'snare' | 'hat-closed' | 'hat-open' | 'tom-lo' | 'tom-hi' | 'rim' | 'clap';

function noiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
	const length = Math.ceil(durationSec * ctx.sampleRate);
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	return buffer;
}

function tone(
	ctx: AudioContext,
	t: number,
	freqStart: number,
	freqEnd: number,
	durationSec: number,
	gain: number,
	type: OscillatorType = 'sine'
): void {
	const osc = ctx.createOscillator();
	const env = ctx.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freqStart, t);
	osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + durationSec);
	env.gain.setValueAtTime(gain, t);
	env.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
	osc.connect(env);
	env.connect(ctx.destination);
	osc.start(t);
	osc.stop(t + durationSec);
}

function noise(
	ctx: AudioContext,
	t: number,
	durationSec: number,
	gain: number,
	filterType: BiquadFilterType,
	filterFreq: number
): void {
	const src = ctx.createBufferSource();
	src.buffer = noiseBuffer(ctx, durationSec);
	const filter = ctx.createBiquadFilter();
	filter.type = filterType;
	filter.frequency.value = filterFreq;
	const env = ctx.createGain();
	env.gain.setValueAtTime(gain, t);
	env.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
	src.connect(filter);
	filter.connect(env);
	env.connect(ctx.destination);
	src.start(t);
	src.stop(t + durationSec);
}

export function triggerDrum(sound: DrumSound): void {
	const ctx = getAudioContext();
	if (ctx.state !== 'running') void ctx.resume(); // 패드 클릭 = 사용자 제스처
	const t = ctx.currentTime;
	switch (sound) {
		case 'kick':
			tone(ctx, t, 150, 40, 0.35, 0.9);
			break;
		case 'snare':
			tone(ctx, t, 190, 120, 0.15, 0.4, 'triangle');
			noise(ctx, t, 0.18, 0.5, 'highpass', 1200);
			break;
		case 'hat-closed':
			noise(ctx, t, 0.05, 0.35, 'highpass', 7000);
			break;
		case 'hat-open':
			noise(ctx, t, 0.4, 0.3, 'highpass', 6500);
			break;
		case 'tom-lo':
			tone(ctx, t, 130, 70, 0.3, 0.6);
			break;
		case 'tom-hi':
			tone(ctx, t, 220, 130, 0.25, 0.55);
			break;
		case 'rim':
			tone(ctx, t, 800, 500, 0.05, 0.35, 'square');
			break;
		case 'clap': {
			// 짧은 노이즈 버스트 3연타 — 클랩의 관용적 합성
			noise(ctx, t, 0.05, 0.4, 'bandpass', 1500);
			noise(ctx, t + 0.02, 0.05, 0.35, 'bandpass', 1500);
			noise(ctx, t + 0.04, 0.2, 0.3, 'bandpass', 1500);
			break;
		}
	}
}
