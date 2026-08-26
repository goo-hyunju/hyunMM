// 드럼패드 — 8패드 합성 드럼, 마우스·키보드 입력. 비트 녹음은 다음 단계.
import { useCallback, useEffect, useRef, useState } from 'react';
import { triggerDrum, type DrumSound } from '../../audio-engine/drumSynth';
import { hasModifier, isTypingTarget } from '../../app/domGuards';

interface PadDef {
	sound: DrumSound;
	label: string;
	hotkey: string;
}

const PADS: PadDef[] = [
	{ sound: 'kick', label: '킥', hotkey: 'z' },
	{ sound: 'snare', label: '스네어', hotkey: 'x' },
	{ sound: 'hat-closed', label: '클로즈드 햇', hotkey: 'c' },
	{ sound: 'hat-open', label: '오픈 햇', hotkey: 'v' },
	{ sound: 'tom-lo', label: '로우 탐', hotkey: 'a' },
	{ sound: 'tom-hi', label: '하이 탐', hotkey: 's' },
	{ sound: 'rim', label: '림', hotkey: 'd' },
	{ sound: 'clap', label: '클랩', hotkey: 'f' },
];

const FLASH_MS = 120;

export function DrumPad() {
	const [flashing, setFlashing] = useState<Record<string, boolean>>({});
	// sound별 타이머 — 연타 시 이전 타이머가 새 플래시를 조기 소등하지 않게 개별 관리
	const flashTimers = useRef<Partial<Record<DrumSound, number>>>({});

	const hit = useCallback((sound: DrumSound) => {
		triggerDrum(sound);
		setFlashing((prev) => ({ ...prev, [sound]: true }));
		const prevTimer = flashTimers.current[sound];
		if (prevTimer !== undefined) window.clearTimeout(prevTimer);
		flashTimers.current[sound] = window.setTimeout(() => {
			setFlashing((prev) => ({ ...prev, [sound]: false }));
			delete flashTimers.current[sound];
		}, FLASH_MS);
	}, []);

	// 키보드 입력 — 외부 시스템(document 이벤트) 구독, cleanup 필수
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat || hasModifier(e) || isTypingTarget(e.target)) return;
			const pad = PADS.find((p) => p.hotkey === e.key.toLowerCase());
			if (pad) hit(pad.sound);
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [hit]);

	// unmount 시 잔여 플래시 타이머 해제
	useEffect(
		() => () => {
			for (const timer of Object.values(flashTimers.current)) window.clearTimeout(timer);
		},
		[]
	);

	return (
		<section aria-label="드럼패드" className="drum-pad">
			<div className="drum-pad-grid">
				{PADS.map((pad) => (
					<button
						key={pad.sound}
						type="button"
						className={`drum-pad-cell${flashing[pad.sound] ? ' drum-pad-hit' : ''}`}
						onPointerDown={() => hit(pad.sound)}
					>
						<span className="drum-pad-label">{pad.label}</span>
						<kbd>{pad.hotkey.toUpperCase()}</kbd>
					</button>
				))}
			</div>
		</section>
	);
}
