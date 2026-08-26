import { memo } from 'react';
import type { Clip, Track } from '../../app/types/project';
import { ClipBlock } from './ClipBlock';

interface TrackLaneProps {
	track: Track;
	clips: Clip[];
}

// memo로 리렌더 경계 — track/clips 참조가 안 바뀌면 스킵 (transport 상태 변경에 면역)
export const TrackLane = memo(function TrackLane({ track, clips }: TrackLaneProps) {
	return (
		<div className="track-lane" role="group" aria-label={`트랙 ${track.name}`}>
			<div className="track-header">
				<span className="track-name">{track.name}</span>
				<span className="track-kind">{track.kind}</span>
			</div>
			<div className="track-clips">
				{clips.map((clip) => (
					<ClipBlock key={clip.id} clip={clip} />
				))}
			</div>
		</div>
	);
});
