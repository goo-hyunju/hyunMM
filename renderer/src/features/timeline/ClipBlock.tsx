import type { Clip } from '../../app/types/project';
import { beatsToPx } from './timelineGeometry';

interface ClipBlockProps {
	clip: Clip;
}

export function ClipBlock({ clip }: ClipBlockProps) {
	const aiClass = clip.origin.source === 'ai' ? ' clip-ai' : '';
	return (
		<div
			className={`clip-block clip-${clip.media.kind}${aiClass}`}
			style={{ left: beatsToPx(clip.startBeat), width: beatsToPx(clip.lengthBeats) }}
			title={clip.name}
		>
			{clip.name}
		</div>
	);
}
