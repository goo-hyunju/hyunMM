import { beatsToPx } from './timelineGeometry';

interface TimelineRulerProps {
	totalBars: number;
	beatsPerBar: number;
}

export function TimelineRuler({ totalBars, beatsPerBar }: TimelineRulerProps) {
	const barWidth = beatsToPx(beatsPerBar);
	const bars = Array.from({ length: totalBars }, (_, i) => i + 1);
	return (
		<div className="timeline-ruler" aria-hidden="true">
			<div className="ruler-spacer" />
			{/* 마디 번호가 곧 도메인 식별자 — 고정 그리드라 재정렬·삽입이 없다 */}
			{bars.map((barNumber) => (
				<span key={barNumber} className="ruler-bar" style={{ width: barWidth }}>
					{barNumber}
				</span>
			))}
		</div>
	);
}
