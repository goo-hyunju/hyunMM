// 컨텍스트 스냅샷 빌더 — 계약 필드만 화이트리스트로 명시 매핑한다.
// spread 금지: project.json의 "알 수 없는 필드 보존"분이 흘러들면 서비스 extra="forbid"에 422.
import type { Project } from '../../app/types/project';
import type { ProjectContextSnapshot } from '../../app/types/serviceContract';

export function buildContextSnapshot(p: Project): ProjectContextSnapshot {
	return {
		bpm: p.bpm,
		timeSignature: {
			numerator: p.timeSignature.numerator,
			denominator: p.timeSignature.denominator,
		},
		key: p.key ? { tonic: p.key.tonic, mode: p.key.mode } : null,
		tracks: p.tracks.map((t) => ({
			id: t.id,
			name: t.name,
			kind: t.kind,
			volume: t.volume,
			pan: t.pan,
			mute: t.mute,
			solo: t.solo,
		})),
		clips: p.clips.map((c) => ({
			id: c.id,
			trackId: c.trackId,
			name: c.name,
			startBeat: c.startBeat,
			lengthBeats: c.lengthBeats,
			media:
				c.media.kind === 'audio'
					? { kind: 'audio', path: c.media.path, durationSec: c.media.durationSec }
					: { kind: 'midi', path: c.media.path },
			origin: {
				source: c.origin.source,
				...(c.origin.jobId !== undefined && { jobId: c.origin.jobId }),
				...(c.origin.prompt !== undefined && { prompt: c.origin.prompt }),
			},
		})),
	};
}
