import { create } from 'zustand';
import type { Clip, Project, Track } from '../types/project';
import { DEMO_PROJECT } from './demoProject';
import { useTransportStore } from './useTransportStore';

interface ProjectState {
	project: Project;
	setProject: (project: Project) => void; // 향후 IPC 프로젝트 로드가 여기로 들어온다
	addTrack: (track: Track) => void;
	addClip: (clip: Clip) => void;
	updateTrack: (trackId: string, patch: Partial<Omit<Track, 'id'>>) => void;
}

// project.json의 bpm이 진실 — 프로젝트가 바뀔 때 transport를 여기서 동기화한다.
// TODO: 역방향(transport setBpm → project.bpm 반영)은 프로젝트 저장 구현 시.
function applyProjectBpm(bpm: number): void {
	useTransportStore.getState().setBpm(bpm);
}

export const useProjectStore = create<ProjectState>((set) => ({
	project: DEMO_PROJECT,
	setProject: (project) => {
		applyProjectBpm(project.bpm);
		set({ project });
	},
	addTrack: (track) =>
		set((s) => ({
			project: {
				...s.project,
				tracks: [...s.project.tracks, track],
				updatedAt: new Date().toISOString(),
			},
		})),
	addClip: (clip) =>
		set((s) => ({
			project: {
				...s.project,
				clips: [...s.project.clips, clip],
				updatedAt: new Date().toISOString(),
			},
		})),
	updateTrack: (trackId, patch) =>
		set((s) => ({
			project: {
				...s.project,
				// 미변경 트랙의 참조를 보존한다 — TrackLane memo 경계 유지
				tracks: s.project.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
				updatedAt: new Date().toISOString(),
			},
		})),
}));

/** 대상 트랙의 마지막 클립 끝 beat — 수락 클립 배치용 (겹침 방지) */
export function trackEndBeat(project: Project, trackId: string): number {
	let end = 0;
	for (const c of project.clips) {
		if (c.trackId === trackId) end = Math.max(end, c.startBeat + c.lengthBeats);
	}
	return end;
}

// 부트스트랩 1회 동기화 — 데모 프로젝트의 bpm과 transport의 기본값 이원화 방지
applyProjectBpm(DEMO_PROJECT.bpm);

// selector — project 내 배열 참조를 그대로 반환하므로 새 객체 리터럴 함정 없음
export const selectTracks = (s: ProjectState) => s.project.tracks;
export const selectClips = (s: ProjectState) => s.project.clips;
export const selectTimeSignature = (s: ProjectState) => s.project.timeSignature;
