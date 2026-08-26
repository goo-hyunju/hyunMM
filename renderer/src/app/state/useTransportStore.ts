import { create } from 'zustand';
import * as transport from '../../audio-engine/transport';
import { DEFAULT_BPM } from '../../audio-engine/transportMath';

// 재생 위치(고빈도 갱신)는 이 store에 넣지 않는다 — audio-engine이 직접 관리하고
// UI는 rAF로 읽는다. store에는 저빈도 transport 상태만 둔다.
// 액션이 유일한 진입점이다: 엔진 호출이 성공한 뒤에만 상태를 갱신한다
// (AudioContext.resume 실패 시 UI가 거짓 재생 상태로 가지 않게).
interface TransportState {
	bpm: number;
	isPlaying: boolean;
	play: () => Promise<void>;
	stop: () => void;
	setBpm: (bpm: number) => void;
}

export const useTransportStore = create<TransportState>((set) => ({
	bpm: DEFAULT_BPM,
	isPlaying: false,
	play: async () => {
		try {
			// 실제 시작(true)일 때만 반영 — 재진입 조기 반환·pending 중 stop·resume 실패와 구분
			if (await transport.play()) set({ isPlaying: true });
		} catch (err) {
			// autoplay 정책 등으로 resume 실패 — 버튼이 '재생'으로 남는 것이 사용자 피드백
			console.error('[transport] play 실패:', err);
		}
	},
	stop: () => {
		transport.stop();
		set({ isPlaying: false });
	},
	setBpm: (bpm) => {
		transport.setBpm(bpm);
		set({ bpm: transport.getBpm() }); // clamp 결과를 반영
	},
}));
