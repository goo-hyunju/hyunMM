import { useEffect, useRef } from 'react';
import { getPositionBeats } from '../../audio-engine/transport';
import { useTransportStore } from '../../app/state/useTransportStore';
import { beatsToPx } from './timelineGeometry';

// 재생 위치는 store를 거치지 않는다 — 엔진에서 rAF로 직접 읽어 transform만 갱신.
// 구독은 저빈도 isPlaying 뿐이라 재생 중에도 React 리렌더가 없다.
export function Playhead() {
	const isPlaying = useTransportStore((s) => s.isPlaying);
	const ref = useRef<HTMLDivElement>(null);

	// 외부 시스템(rAF + audio clock) 동기화 — effect의 정당한 사용처
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!isPlaying) {
			el.style.transform = `translateX(${beatsToPx(getPositionBeats())}px)`;
			return;
		}
		let rafId = 0;
		const tick = () => {
			el.style.transform = `translateX(${beatsToPx(getPositionBeats())}px)`;
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	}, [isPlaying]);

	return <div ref={ref} className="playhead" aria-hidden="true" />;
}
