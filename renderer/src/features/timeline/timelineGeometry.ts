// 타임라인 좌표 변환 상수·함수. CSS 변수(--timeline-*)는 Timeline.tsx에서
// 이 상수로부터 주입한다 — TS/CSS 이중 정의 금지.

export const PX_PER_BEAT = 32;
export const TRACK_HEADER_WIDTH = 140;
export const LANE_HEIGHT = 56;
export const RULER_HEIGHT = 28;
export const MIN_BARS = 16;

export function beatsToPx(beats: number): number {
	return beats * PX_PER_BEAT;
}
