// 생성 결과 오디오 미리듣기 — 재생 위치는 store에 넣지 않는다(토글 상태만).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../../audio-engine/audioContext';

export function usePreviewPlayer() {
	const [isPlaying, setIsPlaying] = useState(false);
	const bufferRef = useRef<AudioBuffer | null>(null);
	const sourceRef = useRef<AudioBufferSourceNode | null>(null);

	const load = useCallback(async (bytes: ArrayBuffer) => {
		const ctx = getAudioContext();
		// decodeAudioData는 ArrayBuffer를 detach한다 — 수락 시 같은 bytes를 IPC로 보내야
		// 하므로 반드시 복사본을 디코드한다.
		bufferRef.current = await ctx.decodeAudioData(bytes.slice(0));
	}, []);

	const play = useCallback(async () => {
		if (!bufferRef.current) return;
		const ctx = getAudioContext();
		if (ctx.state !== 'running') await ctx.resume(); // 버튼 클릭 = 사용자 제스처
		if (sourceRef.current) {
			sourceRef.current.onended = null; // 구 source의 지연 onended가 새 재생 상태를 덮지 않게
			sourceRef.current.stop();
		}
		const src = ctx.createBufferSource();
		src.buffer = bufferRef.current;
		src.connect(ctx.destination); // MVP: 프리뷰 게인/버스는 mixer 도입 시 삽입
		src.onended = () => setIsPlaying(false);
		src.start();
		sourceRef.current = src;
		setIsPlaying(true);
	}, []);

	const stop = useCallback(() => {
		sourceRef.current?.stop(); // onended가 state를 정리한다
	}, []);

	const clear = useCallback(() => {
		sourceRef.current?.stop();
		bufferRef.current = null;
	}, []);

	useEffect(
		() => () => {
			sourceRef.current?.stop();
		},
		[]
	);

	// 반환 객체 참조 안정화 — 소비자가 effect 의존성에 넣어도 매 렌더 재실행되지 않게
	return useMemo(
		() => ({ isPlaying, load, play, stop, clear }),
		[isPlaying, load, play, stop, clear]
	);
}
