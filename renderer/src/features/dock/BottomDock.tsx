// 하단 악기 독 — 드럼패드·키보드·믹서 탭 전환.
import { useState } from 'react';
import { DrumPad } from '../drum-pad/DrumPad';
import { Keys } from '../keys/Keys';
import { Mixer } from '../mixer/Mixer';

type DockTab = 'drum-pad' | 'keys' | 'mixer';

const TABS: { id: DockTab; label: string }[] = [
	{ id: 'drum-pad', label: '드럼패드' },
	{ id: 'keys', label: '키보드' },
	{ id: 'mixer', label: '믹서' },
];

export function BottomDock() {
	const [active, setActive] = useState<DockTab>('drum-pad');

	return (
		<div className="dock">
			<div className="dock-tabs" role="tablist" aria-label="악기 독">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={active === tab.id}
						className={active === tab.id ? 'dock-tab dock-tab-active' : 'dock-tab'}
						onClick={() => setActive(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</div>
			<div className="dock-body">
				{active === 'drum-pad' && <DrumPad />}
				{active === 'keys' && <Keys />}
				{active === 'mixer' && <Mixer />}
			</div>
		</div>
	);
}
