import { useMemo, type CSSProperties } from 'react';
import type { Clip } from '../../app/types/project';
import {
	selectClips,
	selectTimeSignature,
	selectTracks,
	useProjectStore,
} from '../../app/state/useProjectStore';
import { Playhead } from './Playhead';
import { TimelineRuler } from './TimelineRuler';
import { TrackLane } from './TrackLane';
import {
	beatsToPx,
	LANE_HEIGHT,
	MIN_BARS,
	RULER_HEIGHT,
	TRACK_HEADER_WIDTH,
} from './timelineGeometry';

const EMPTY_CLIPS: Clip[] = []; // 매 렌더 새 배열 방지

// TS 상수를 CSS 변수로 주입 — timelineGeometry 와 CSS 의 이중 정의 방지
const TIMELINE_CSS_VARS = {
	'--timeline-header-w': `${TRACK_HEADER_WIDTH}px`,
	'--timeline-lane-h': `${LANE_HEIGHT}px`,
	'--timeline-ruler-h': `${RULER_HEIGHT}px`,
} as CSSProperties;

export function Timeline() {
	const tracks = useProjectStore(selectTracks);
	const clips = useProjectStore(selectClips);
	const timeSignature = useProjectStore(selectTimeSignature);

	const clipsByTrack = useMemo(() => {
		const map = new Map<string, Clip[]>();
		for (const clip of clips) {
			const list = map.get(clip.trackId);
			if (list) list.push(clip);
			else map.set(clip.trackId, [clip]);
		}
		return map;
	}, [clips]);

	const endBeat = useMemo(
		() => clips.reduce((max, c) => Math.max(max, c.startBeat + c.lengthBeats), 0),
		[clips]
	);

	// MVP 단순화: beat = 1/4음표 가정 (denominator≠4 처리는 후속 — demoProject는 4/4)
	const beatsPerBar = timeSignature.numerator;
	const totalBars = Math.max(MIN_BARS, Math.ceil(endBeat / beatsPerBar) + 2);
	const contentWidth = TRACK_HEADER_WIDTH + beatsToPx(totalBars * beatsPerBar);

	if (tracks.length === 0) {
		return (
			<section aria-label="타임라인" className="timeline" style={TIMELINE_CSS_VARS}>
				<p className="timeline-empty">트랙이 없습니다. 트랙을 추가해 시작하세요.</p>
			</section>
		);
	}

	return (
		<section aria-label="타임라인" className="timeline" style={TIMELINE_CSS_VARS}>
			<div className="timeline-scroll">
				<div className="timeline-content" style={{ width: contentWidth }}>
					<TimelineRuler totalBars={totalBars} beatsPerBar={beatsPerBar} />
					<div className="timeline-lanes">
						{tracks.map((track) => (
							<TrackLane
								key={track.id}
								track={track}
								clips={clipsByTrack.get(track.id) ?? EMPTY_CLIPS}
							/>
						))}
						<Playhead />
					</div>
				</div>
			</div>
		</section>
	);
}
