import { AiCopilotPanel } from './features/ai-copilot/AiCopilotPanel';
import { BottomDock } from './features/dock/BottomDock';
import { Timeline } from './features/timeline/Timeline';
import { TransportControls } from './features/transport/TransportControls';

export function App() {
	return (
		<div className="app-shell">
			<header className="app-header">
				<span className="app-logo">
					hyun<span className="app-logo-accent">MM</span>
				</span>
				<TransportControls />
			</header>
			<div className="app-body">
				<main className="app-main">
					<Timeline />
					<BottomDock />
				</main>
				<aside className="app-side">
					<AiCopilotPanel />
				</aside>
			</div>
		</div>
	);
}
