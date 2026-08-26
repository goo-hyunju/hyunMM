// AI 협업 패널 — 프로젝트 컨텍스트를 담아 생성 요청, 결과 클립 미리듣기·수락·거절.
import { useEffect, useState } from 'react';
import { selectTracks, trackEndBeat, useProjectStore } from '../../app/state/useProjectStore';
import type { Clip, Track } from '../../app/types/project';
import { buildContextSnapshot } from './buildContextSnapshot';
import { useGenerationJob } from './useGenerationJob';
import { usePreviewPlayer } from './usePreviewPlayer';

const PROMPT_MAX = 2000; // 계약: prompt 1~2000자 — UI 사전 차단
const NEW_TRACK = '__new__';

const STAGE_LABEL: Record<string, string> = {
	queued: '대기 중',
	loading_model: '모델 준비 중',
	generating: '생성 중',
	encoding: '인코딩 중',
};

function newId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export function AiCopilotPanel() {
	const tracks = useProjectStore(selectTracks);
	const addTrack = useProjectStore((s) => s.addTrack);
	const addClip = useProjectStore((s) => s.addClip);

	const [prompt, setPrompt] = useState('');
	const [targetTrackId, setTargetTrackId] = useState<string>(NEW_TRACK);
	const [notice, setNotice] = useState<string | null>(null);
	const [accepting, setAccepting] = useState(false); // 수락 IPC 진행 중 — 중복 수락·수락 중 거절 차단

	const { phase, start, cancel, reset } = useGenerationJob();
	const preview = usePreviewPlayer();

	// MVP: 오디오만 — MIDI는 SMF 파서(미리듣기 수단) 확보 전까지 비활성.
	// 미리듣기 없는 수락은 사용자 주권 원칙 위반이라 허용하지 않는다.
	const audioTracks = tracks.filter((t) => t.kind === 'audio');

	// 결과 도착 시 미리듣기 버퍼 준비 — 외부 시스템(AudioContext) 동기화.
	// 의존성은 참조 안정한 액션만 — preview 컨테이너 객체를 넣으면 렌더마다 재디코드된다.
	const { load: previewLoad, clear: previewClear } = preview;
	useEffect(() => {
		if (phase.name === 'succeeded') void previewLoad(phase.bytes);
		else previewClear();
	}, [phase, previewLoad, previewClear]);

	const promptValid = prompt.trim().length > 0 && prompt.length <= PROMPT_MAX;
	const busy = phase.name === 'requesting' || phase.name === 'generating';

	const submit = () => {
		setNotice(null);
		const project = useProjectStore.getState().project;
		void start({
			prompt: prompt.trim(),
			output: { kind: 'audio', lengthBeats: 16 },
			targetTrackId: targetTrackId === NEW_TRACK ? null : targetTrackId,
			context: buildContextSnapshot(project),
		});
	};

	const accept = async () => {
		if (phase.name !== 'succeeded' || phase.result.kind !== 'audio' || accepting) return;
		setAccepting(true);
		try {
			const project = useProjectStore.getState().project;

			let track: Track;
			if (targetTrackId === NEW_TRACK || !project.tracks.some((t) => t.id === targetTrackId)) {
				track = {
					id: newId('trk'),
					name: 'AI Audio',
					kind: 'audio',
					volume: 1,
					pan: 0,
					mute: false,
					solo: false,
				};
			} else {
				track = project.tracks.find((t) => t.id === targetTrackId) as Track;
			}

			const clipId = newId('clp');
			const relPath = `audio/${clipId}.wav`;

			// Electron: 저장 → 스토어 순서로 파일 없는 유령 클립 방지.
			// 브라우저 단독(dev): 합의된 degraded 동작 — 세션 한정 인메모리 클립으로 추가하되 반드시 표시.
			if (window.hyunmm?.saveClipMedia) {
				try {
					await window.hyunmm.saveClipMedia(project.name, relPath, phase.bytes);
				} catch (e) {
					setNotice(`미디어 저장 실패: ${e instanceof Error ? e.message : String(e)}`);
					return;
				}
			} else {
				setNotice('브라우저 모드 — 클립은 이 세션에만 존재하며 파일로 저장되지 않았습니다');
			}

			if (track.id !== targetTrackId) addTrack(track);
			// 저장 IPC 대기 중 프로젝트가 바뀌었을 수 있다 — 배치 계산은 최신 상태 기준
			const latest = useProjectStore.getState().project;
			const clip: Clip = {
				id: clipId,
				trackId: track.id,
				name: prompt.trim().slice(0, 24) || 'AI Clip',
				startBeat: trackEndBeat(latest, track.id),
				lengthBeats: phase.result.suggestedLengthBeats,
				media: { kind: 'audio', path: relPath, durationSec: phase.result.durationSec },
				origin: { source: 'ai', jobId: phase.jobId, prompt: prompt.trim() },
			};
			addClip(clip);
			reset();
		} finally {
			setAccepting(false);
		}
	};

	return (
		<section aria-label="AI 코파일럿" className="ai-copilot">
			<h2 className="ai-copilot-title">AI 코파일럿</h2>

			<label className="ai-copilot-field">
				요청
				<textarea
					value={prompt}
					maxLength={PROMPT_MAX}
					placeholder="예: 어두운 808 베이스라인, 미니멀하게"
					onChange={(e) => setPrompt(e.target.value)}
					disabled={busy}
				/>
			</label>

			<div className="ai-copilot-row">
				<label className="ai-copilot-field">
					출력
					<span className="ai-copilot-kind">
						오디오 스템
						<span className="ai-copilot-muted">
							(MIDI는 미리듣기 수단 확보 후 지원 — 미리듣기 없는 수락은 제공하지 않음)
						</span>
					</span>
				</label>
				<label className="ai-copilot-field">
					대상 트랙
					<select
						value={targetTrackId}
						onChange={(e) => setTargetTrackId(e.target.value)}
						disabled={busy}
					>
						<option value={NEW_TRACK}>새 트랙</option>
						{audioTracks.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
				</label>
				<button type="button" onClick={submit} disabled={!promptValid || busy}>
					생성
				</button>
			</div>

			{phase.name === 'requesting' && <p className="ai-copilot-status">요청 중…</p>}

			{phase.name === 'generating' && (
				<div className="ai-copilot-status">
					<span>{STAGE_LABEL[phase.stage] ?? phase.stage}</span>
					{phase.progress !== undefined ? (
						<progress value={phase.progress} max={1} />
					) : (
						<progress /> // indeterminate
					)}
					<button type="button" onClick={() => void cancel(phase.jobId)}>
						취소
					</button>
				</div>
			)}

			{phase.name === 'failed' && (
				<div className="ai-copilot-status ai-copilot-error" role="alert">
					<span>실패: {phase.error}</span>
					<button type="button" onClick={reset}>
						확인
					</button>
				</div>
			)}

			{phase.name === 'cancelled' && (
				<div className="ai-copilot-status">
					<span>취소됨</span>
					<button type="button" onClick={reset}>
						확인
					</button>
				</div>
			)}

			{phase.name === 'succeeded' && (
				<div className="ai-copilot-status">
					<span>생성 완료 — 미리듣기 후 수락하세요</span>
					<button
						type="button"
						disabled={accepting}
						onClick={() => (preview.isPlaying ? preview.stop() : void preview.play())}
					>
						{preview.isPlaying ? '정지' : '미리듣기'}
					</button>
					<button type="button" disabled={accepting} onClick={() => void accept()}>
						{accepting ? '저장 중…' : '수락'}
					</button>
					<button type="button" disabled={accepting} onClick={reset}>
						거절
					</button>
				</div>
			)}

			{notice && <p className="ai-copilot-notice">{notice}</p>}
		</section>
	);
}
