import { describe, expect, it } from 'vitest';
import type { Project } from '../../app/types/project';
import { buildContextSnapshot } from './buildContextSnapshot';

const BASE: Project = {
	schemaVersion: 1,
	name: 'test',
	bpm: 100,
	timeSignature: { numerator: 4, denominator: 4 },
	key: { tonic: 'D', mode: 'major' },
	tracks: [{ id: 'trk_1', name: 'T1', kind: 'audio', volume: 1, pan: 0, mute: false, solo: false }],
	clips: [
		{
			id: 'clp_1',
			trackId: 'trk_1',
			name: 'C1',
			startBeat: 0,
			lengthBeats: 4,
			media: { kind: 'audio', path: 'audio/clp_1.wav', durationSec: 2.4 },
			origin: { source: 'user' },
		},
	],
	createdAt: '2026-08-24T00:00:00.000Z',
	updatedAt: '2026-08-24T00:00:00.000Z',
};

describe('buildContextSnapshot', () => {
	it('계약 필드만 매핑한다 (미지 필드 제거 — extra=forbid 방어)', () => {
		// project.json 로드 규칙상 보존될 수 있는 미지 필드를 주입
		const polluted = JSON.parse(JSON.stringify(BASE)) as Project;
		(polluted as unknown as Record<string, unknown>).futureField = 'x';
		(polluted.tracks[0] as unknown as Record<string, unknown>).color = '#fff';
		(polluted.clips[0] as unknown as Record<string, unknown>).selected = true;

		const snap = buildContextSnapshot(polluted);
		expect(snap).toEqual({
			bpm: 100,
			timeSignature: { numerator: 4, denominator: 4 },
			key: { tonic: 'D', mode: 'major' },
			tracks: [
				{ id: 'trk_1', name: 'T1', kind: 'audio', volume: 1, pan: 0, mute: false, solo: false },
			],
			clips: [
				{
					id: 'clp_1',
					trackId: 'trk_1',
					name: 'C1',
					startBeat: 0,
					lengthBeats: 4,
					media: { kind: 'audio', path: 'audio/clp_1.wav', durationSec: 2.4 },
					origin: { source: 'user' },
				},
			],
		});
	});

	it('key 미지정은 명시적 null, origin optional은 생략', () => {
		const snap = buildContextSnapshot({ ...BASE, key: null });
		expect(snap.key).toBeNull();
		expect('jobId' in snap.clips[0].origin).toBe(false);
	});
});
