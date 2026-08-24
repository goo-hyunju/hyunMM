import { AiCopilotPanel } from './features/ai-copilot/AiCopilotPanel';
import { DrumPad } from './features/drum-pad/DrumPad';
import { Keys } from './features/keys/Keys';
import { Mixer } from './features/mixer/Mixer';
import { Timeline } from './features/timeline/Timeline';

export function App() {
	return (
		<div>
			<h1>hyunMM — AI DAW (스캐폴드)</h1>
			<Timeline />
			<DrumPad />
			<Keys />
			<Mixer />
			<AiCopilotPanel />
		</div>
	);
}
