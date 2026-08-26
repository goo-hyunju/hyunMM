// 가상 키보드용 폴리 신스 — saw + lowpass + ADSR 최소 구성.
// 보이스는 노트 단위 Map으로 관리하고 noteOff에서 해제한다.

import { getAudioContext } from './audioContext';

const MAX_VOICES = 8;
const ATTACK_SEC = 0.005;
const RELEASE_SEC = 0.25;
const VOICE_GAIN = 0.18;
const FILTER_FREQ_HZ = 2400;

interface Voice {
	osc: OscillatorNode;
	env: GainNode;
}

const voices = new Map<number, Voice>();

export function midiToFreq(note: number): number {
	return 440 * 2 ** ((note - 69) / 12);
}

export function noteOn(note: number): void {
	const ctx = getAudioContext();
	if (ctx.state !== 'running') void ctx.resume(); // 건반 입력 = 사용자 제스처
	if (voices.has(note)) return; // 키 리피트 방어
	if (voices.size >= MAX_VOICES) {
		// 가장 먼저 눌린 보이스를 훔친다
		const first = voices.keys().next().value;
		if (first !== undefined) noteOff(first);
	}
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const filter = ctx.createBiquadFilter();
	const env = ctx.createGain();
	osc.type = 'sawtooth';
	osc.frequency.value = midiToFreq(note);
	filter.type = 'lowpass';
	filter.frequency.value = FILTER_FREQ_HZ;
	env.gain.setValueAtTime(0.0001, t);
	env.gain.exponentialRampToValueAtTime(VOICE_GAIN, t + ATTACK_SEC);
	osc.connect(filter);
	filter.connect(env);
	env.connect(ctx.destination);
	osc.start(t);
	voices.set(note, { osc, env });
}

export function noteOff(note: number): void {
	const voice = voices.get(note);
	if (!voice) return;
	voices.delete(note);
	const ctx = getAudioContext();
	const t = ctx.currentTime;
	voice.env.gain.cancelScheduledValues(t);
	voice.env.gain.setValueAtTime(voice.env.gain.value, t);
	voice.env.gain.exponentialRampToValueAtTime(0.0001, t + RELEASE_SEC);
	voice.osc.stop(t + RELEASE_SEC + 0.05);
}

export function allNotesOff(): void {
	for (const note of [...voices.keys()]) noteOff(note);
}
