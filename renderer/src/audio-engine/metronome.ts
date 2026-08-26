// 메트로놈 — lookahead 스케줄링("A Tale of Two Clocks" 패턴).
// setInterval은 스케줄 시점만 정하고, 클릭의 정확한 타이밍은 AudioContext 클럭으로 예약한다.
// 클릭당 OscillatorNode 생성은 Web Audio의 1회용 노드 모델 그대로다 —
// 무할당 원칙(Gotchas)은 rAF 등 고빈도 루프 대상이며, 이 tick은 25ms 간격에 클릭당 1회다.

import { getAudioContext } from './audioContext';

const LOOKAHEAD_SEC = 0.1; // 스케줄 선행 구간 — tick 간격보다 충분히 길어 스로틀링에 견딘다
const TICK_INTERVAL_MS = 25;
const CLICK_DURATION_SEC = 0.03;
const ACCENT_FREQ_HZ = 1000;
const CLICK_FREQ_HZ = 760;
const CLICK_GAIN = 0.25;
// TODO: timeSignature 연동 (denominator 처리와 함께 — 현재 데모는 4/4)
const BEATS_PER_BAR = 4;

let timerId: number | null = null;
let bus: GainNode | null = null;
let nextBeat = 0;

/**
 * beatToCtxTime은 transport의 살아 있는 anchor를 읽으므로,
 * 재생 중 BPM이 재기준화되면 이후 클릭은 자동으로 새 템포를 따른다.
 */
export function startMetronome(fromBeat: number, beatToCtxTime: (beat: number) => number): void {
	stopMetronome();
	const ctx = getAudioContext();
	bus = ctx.createGain();
	bus.connect(ctx.destination);
	nextBeat = Math.ceil(fromBeat);

	timerId = window.setInterval(() => {
		if (!bus) return;
		const horizon = ctx.currentTime + LOOKAHEAD_SEC;
		while (beatToCtxTime(nextBeat) < horizon) {
			scheduleClick(ctx, bus, beatToCtxTime(nextBeat), nextBeat % BEATS_PER_BAR === 0);
			nextBeat += 1;
		}
	}, TICK_INTERVAL_MS);
}

export function stopMetronome(): void {
	if (timerId !== null) {
		window.clearInterval(timerId);
		timerId = null;
	}
	if (bus) {
		// 이미 예약된 미래 클릭까지 함께 끊는다
		bus.disconnect();
		bus = null;
	}
}

function scheduleClick(ctx: AudioContext, out: GainNode, at: number, accent: boolean): void {
	const t = Math.max(at, ctx.currentTime);
	const osc = ctx.createOscillator();
	const env = ctx.createGain();
	osc.frequency.value = accent ? ACCENT_FREQ_HZ : CLICK_FREQ_HZ;
	env.gain.setValueAtTime(CLICK_GAIN, t);
	env.gain.exponentialRampToValueAtTime(0.001, t + CLICK_DURATION_SEC);
	osc.connect(env);
	env.connect(out);
	osc.start(t);
	osc.stop(t + CLICK_DURATION_SEC);
}
