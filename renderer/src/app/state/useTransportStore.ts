import { create } from 'zustand';

// 재생 위치(고빈도 갱신)는 이 store에 넣지 않는다 — audio-engine이 직접 관리하고
// UI는 rAF로 읽는다. store에는 저빈도 transport 상태만 둔다.
interface TransportState {
	bpm: number;
	isPlaying: boolean;
	setBpm: (bpm: number) => void;
	play: () => void;
	stop: () => void;
}

export const useTransportStore = create<TransportState>((set) => ({
	bpm: 120,
	isPlaying: false,
	setBpm: (bpm) => set({ bpm }),
	play: () => set({ isPlaying: true }),
	stop: () => set({ isPlaying: false }),
}));
