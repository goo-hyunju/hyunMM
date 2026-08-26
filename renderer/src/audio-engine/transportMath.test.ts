import { describe, expect, it } from 'vitest';
import {
	clampBpm,
	ctxTimeAtBeat,
	positionBeatsAt,
	DEFAULT_BPM,
	MAX_BPM,
	MIN_BPM,
} from './transportMath';

describe('positionBeatsAt', () => {
	it('120bpm에서 1초는 2 beat', () => {
		expect(positionBeatsAt(11, 10, 0, 120)).toBe(2);
	});

	it('anchor beat 오프셋을 유지한다', () => {
		expect(positionBeatsAt(10.5, 10, 8, 120)).toBe(9);
	});
});

describe('BPM 재기준화 연속성', () => {
	it('재기준화 직전(구 bpm)과 직후(새 bpm anchor)의 위치가 같다', () => {
		const t0 = 42.37;
		const pos = positionBeatsAt(t0, 40, 4, 90);
		expect(positionBeatsAt(t0, t0, pos, 150)).toBeCloseTo(pos, 12);
	});
});

describe('ctxTimeAtBeat', () => {
	it('positionBeatsAt의 역함수다', () => {
		const t = 123.456;
		const beats = positionBeatsAt(t, 100, 2, 133);
		expect(ctxTimeAtBeat(beats, 100, 2, 133)).toBeCloseTo(t, 9);
	});
});

describe('clampBpm', () => {
	it('범위 내 값은 그대로', () => {
		expect(clampBpm(120)).toBe(120);
	});

	it('상하한으로 clamp', () => {
		expect(clampBpm(1)).toBe(MIN_BPM);
		expect(clampBpm(9999)).toBe(MAX_BPM);
	});

	it('NaN·Infinity는 기본값', () => {
		expect(clampBpm(Number.NaN)).toBe(DEFAULT_BPM);
		expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(DEFAULT_BPM);
	});
});
