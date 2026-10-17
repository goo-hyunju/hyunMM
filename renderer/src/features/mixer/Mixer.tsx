// 믹서 — 트랙별 볼륨·팬·뮤트·솔로. 상태는 project store가 진실.
// 오디오 경로 반영(클립 재생 게인)은 클립 재생 구현 시 audio-engine에서 소비한다.
import type { Track } from '../../app/types/project';
import { selectTracks, useProjectStore } from '../../app/state/useProjectStore';

export function Mixer() {
	const tracks = useProjectStore(selectTracks);
	const updateTrack = useProjectStore((s) => s.updateTrack);

	if (tracks.length === 0) {
		return (
			<section aria-label="믹서" className="mixer">
				<p className="mixer-empty">트랙이 없습니다.</p>
			</section>
		);
	}

	return (
		<section aria-label="믹서" className="mixer">
			{tracks.map((track) => (
				<MixerStrip key={track.id} track={track} onChange={updateTrack} />
			))}
		</section>
	);
}

interface MixerStripProps {
	track: Track;
	onChange: (trackId: string, patch: Partial<Omit<Track, 'id'>>) => void;
}

function MixerStrip({ track, onChange }: MixerStripProps) {
	return (
		<div className="mixer-strip" role="group" aria-label={`믹서 ${track.name}`}>
			<span className="mixer-name">{track.name}</span>
			<label className="mixer-fader">
				<input
					type="range"
					min={0}
					max={2}
					step={0.01}
					value={track.volume}
					aria-label={`${track.name} 볼륨`}
					onChange={(e) => onChange(track.id, { volume: Number(e.target.value) })}
				/>
				<span className="mixer-value">{Math.round(track.volume * 100)}</span>
			</label>
			<label className="mixer-pan">
				<input
					type="range"
					min={-1}
					max={1}
					step={0.01}
					value={track.pan}
					aria-label={`${track.name} 팬`}
					onChange={(e) => onChange(track.id, { pan: Number(e.target.value) })}
				/>
				<span className="mixer-value">
					{track.pan === 0
						? 'C'
						: track.pan < 0
							? `L${Math.round(-track.pan * 100)}`
							: `R${Math.round(track.pan * 100)}`}
				</span>
			</label>
			<div className="mixer-toggles">
				<button
					type="button"
					className={track.mute ? 'mixer-toggle-on' : ''}
					aria-pressed={track.mute}
					onClick={() => onChange(track.id, { mute: !track.mute })}
				>
					M
				</button>
				<button
					type="button"
					className={track.solo ? 'mixer-toggle-on mixer-solo-on' : ''}
					aria-pressed={track.solo}
					onClick={() => onChange(track.id, { solo: !track.solo })}
				>
					S
				</button>
			</div>
		</div>
	);
}
