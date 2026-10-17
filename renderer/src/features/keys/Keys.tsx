// 가상 키보드 — 온스크린 2옥타브 + 컴퓨터 키보드 입력. 외부 MIDI(Web MIDI)는 다음 단계.
import { useCallback, useEffect, useState } from 'react';
import { allNotesOff, noteOff, noteOn } from '../../audio-engine/keySynth';
import { hasModifier, isTypingTarget } from '../../app/domGuards';

// 컴퓨터 키보드 → 반음 오프셋 (A=도 기준의 관용 배치)
const KEY_TO_OFFSET: Record<string, number> = {
	a: 0,
	w: 1,
	s: 2,
	e: 3,
	d: 4,
	f: 5,
	t: 6,
	g: 7,
	y: 8,
	h: 9,
	u: 10,
	j: 11,
	k: 12,
};

const OCTAVE_MIN = 2;
const OCTAVE_MAX = 6;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);

export function Keys() {
	const [octave, setOctave] = useState(4); // C4 시작
	const [pressed, setPressed] = useState<Record<number, boolean>>({});

	const baseNote = octave * 12; // C(octave) 의 MIDI 노트 (C4=48 관례상 60이나 표기 차이는 UI 밖 관심사)

	const press = useCallback((note: number) => {
		noteOn(note);
		setPressed((prev) => (prev[note] ? prev : { ...prev, [note]: true }));
	}, []);

	const release = useCallback((note: number) => {
		noteOff(note);
		setPressed((prev) => {
			if (!prev[note]) return prev;
			const next = { ...prev };
			delete next[note];
			return next;
		});
	}, []);

	// 컴퓨터 키보드 — 외부 시스템 구독, cleanup 필수
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.repeat || hasModifier(e) || isTypingTarget(e.target)) return;
			const k = e.key.toLowerCase();
			if (k === ',') setOctave((o) => Math.max(OCTAVE_MIN, o - 1));
			else if (k === '.') setOctave((o) => Math.min(OCTAVE_MAX, o + 1));
			else if (k in KEY_TO_OFFSET) press(baseNote + KEY_TO_OFFSET[k]);
		};
		const onKeyUp = (e: KeyboardEvent) => {
			// 가드 없이 항상 release — stuck note 방지 (release는 no-op 안전)
			const k = e.key.toLowerCase();
			if (k in KEY_TO_OFFSET) release(baseNote + KEY_TO_OFFSET[k]);
		};
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('keyup', onKeyUp);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('keyup', onKeyUp);
			// 옥타브 변경·unmount 시 걸린 노트와 시각 상태를 함께 정리 —
			// baseNote가 바뀌면 keyup이 다른 노트를 release 해 pressed가 고착된다
			allNotesOff();
			setPressed({});
		};
	}, [baseNote, press, release]);

	const notes = Array.from({ length: 25 }, (_, i) => baseNote + i); // 2옥타브 + 도

	return (
		<section aria-label="키보드" className="keys">
			<div className="keys-toolbar">
				<button
					type="button"
					onClick={() => setOctave((o) => Math.max(OCTAVE_MIN, o - 1))}
					disabled={octave <= OCTAVE_MIN}
				>
					옥타브 −
				</button>
				<span className="keys-octave">C{octave}</span>
				<button
					type="button"
					onClick={() => setOctave((o) => Math.min(OCTAVE_MAX, o + 1))}
					disabled={octave >= OCTAVE_MAX}
				>
					옥타브 +
				</button>
				<span className="keys-hint">건반: A~K · 옥타브: , .</span>
			</div>
			<div className="keys-bed">
				{notes.map((note) => {
					const pc = note % 12;
					const isBlack = BLACK.has(pc);
					return (
						<button
							key={note}
							type="button"
							className={`key ${isBlack ? 'key-black' : 'key-white'}${pressed[note] ? ' key-pressed' : ''}`}
							aria-label={`${NOTE_NAMES[pc]}${Math.floor(note / 12)}`}
							onPointerDown={() => press(note)}
							onPointerUp={() => release(note)}
							onPointerLeave={() => release(note)}
							onPointerCancel={() => release(note)}
						/>
					);
				})}
			</div>
		</section>
	);
}
