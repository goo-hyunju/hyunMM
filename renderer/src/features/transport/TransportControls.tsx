import { useState } from 'react';
import { useTransportStore } from '../../app/state/useTransportStore';
import { MAX_BPM, MIN_BPM } from '../../audio-engine/transportMath';

export function TransportControls() {
	const isPlaying = useTransportStore((s) => s.isPlaying);
	const bpm = useTransportStore((s) => s.bpm);
	const play = useTransportStore((s) => s.play);
	const stop = useTransportStore((s) => s.stop);
	const setBpm = useTransportStore((s) => s.setBpm);
	const [bpmDraft, setBpmDraft] = useState(String(bpm)); // 타이핑 중 draft — 일시적 UI 상태

	const commitBpm = () => {
		if (bpmDraft.trim() === '') {
			setBpmDraft(String(bpm)); // 빈 입력은 취소로 간주 — Number('')===0 이 MIN으로 clamp되는 것 방지
			return;
		}
		const parsed = Number(bpmDraft);
		if (Number.isFinite(parsed)) {
			setBpm(parsed);
			setBpmDraft(String(useTransportStore.getState().bpm)); // clamp 결과 반영
		} else {
			setBpmDraft(String(bpm)); // 무효 입력 롤백
		}
	};

	return (
		<div className="transport-controls" role="toolbar" aria-label="트랜스포트">
			<button
				type="button"
				onClick={() => {
					if (isPlaying) stop();
					else void play();
				}}
				aria-pressed={isPlaying}
			>
				{isPlaying ? '정지' : '재생'}
			</button>
			<label className="bpm-field">
				BPM
				<input
					type="number"
					inputMode="numeric"
					min={MIN_BPM}
					max={MAX_BPM}
					value={bpmDraft}
					onChange={(e) => setBpmDraft(e.target.value)}
					onBlur={commitBpm}
					onKeyDown={(e) => {
						if (e.key === 'Enter') commitBpm();
					}}
				/>
			</label>
		</div>
	);
}
