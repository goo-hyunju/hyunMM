// 프로젝트 저장/로드 IPC 구현 전까지 쓰는 데모 fixture.
// project.json 스키마(types/project.ts)를 그대로 준수한다. media.path는 실재 파일이
// 아니어도 된다 — 클립 오디오 재생은 아직 범위 밖이다.
import { PROJECT_SCHEMA_VERSION, type Project } from '../types/project';

export const DEMO_PROJECT: Project = {
	schemaVersion: PROJECT_SCHEMA_VERSION,
	name: 'Demo Project',
	bpm: 120,
	timeSignature: { numerator: 4, denominator: 4 },
	key: { tonic: 'C', mode: 'minor' },
	tracks: [
		{ id: 'trk_drums', name: 'Drums', kind: 'audio', volume: 1, pan: 0, mute: false, solo: false },
		{ id: 'trk_bass', name: 'Bass', kind: 'midi', volume: 0.8, pan: 0, mute: false, solo: false },
		{ id: 'trk_keys', name: 'Keys', kind: 'midi', volume: 0.7, pan: -0.2, mute: false, solo: false },
	],
	clips: [
		{
			id: 'clp_drumloop',
			trackId: 'trk_drums',
			name: 'Drum Loop',
			startBeat: 0,
			lengthBeats: 16,
			media: { kind: 'audio', path: 'audio/clp_drumloop.wav', durationSec: 8 },
			origin: { source: 'user' },
		},
		{
			id: 'clp_bassline',
			trackId: 'trk_bass',
			name: 'AI Bassline',
			startBeat: 8,
			lengthBeats: 8,
			media: { kind: 'midi', path: 'midi/clp_bassline.mid' },
			origin: { source: 'ai', jobId: 'job_demo1', prompt: 'dark bassline' },
		},
		{
			id: 'clp_chords',
			trackId: 'trk_keys',
			name: 'Chords',
			startBeat: 16,
			lengthBeats: 8,
			media: { kind: 'midi', path: 'midi/clp_chords.mid' },
			origin: { source: 'user' },
		},
	],
	createdAt: '2026-08-24T00:00:00.000Z',
	updatedAt: '2026-08-24T00:00:00.000Z',
};
