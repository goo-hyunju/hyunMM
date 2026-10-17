// renderer ↔ Python 서비스 wire 계약 (JSON은 camelCase).
// 변경 시 service/app/api/schemas.py 와 docs/api/generation.md 를 같은 커밋에서 갱신한다.

import type { Clip, MusicalKey, TimeSignature, Track } from './project';

// 생성 요청에 항상 포함되는 프로젝트 컨텍스트 스냅샷 — AI DAW의 전제.
// project.json 스키마의 부분집합을 재사용한다(스키마 이원화 방지).
// v1은 메타데이터만 전송한다 — 서비스는 프로젝트 폴더 경로를 모른다.
// 스냅샷 빌더는 계약 필드만 화이트리스트로 구성한다 — project.json의 미지 필드 보존분을
// 그대로 보내면 서비스 extra="forbid"에 걸려 422다 (docs/api/generation.md).
export interface ProjectContextSnapshot {
	bpm: number;
	timeSignature: TimeSignature;
	key: MusicalKey | null;
	tracks: Track[];
	clips: Clip[];
}

export type OutputKind = 'audio' | 'midi';

export interface GenerateOutputSpec {
	kind: OutputKind; // music_generator / midi_generator 라우팅 키
	lengthBeats: number;
}

export interface GenerateRequest {
	prompt: string;
	output: GenerateOutputSpec;
	targetTrackId: string | null; // null이면 새 트랙 제안
	context: ProjectContextSnapshot;
}

export type ServiceErrorCode =
	'SERVICE_BUSY' | 'MODEL_NOT_LOADED' | 'INVALID_CONTEXT' | 'GENERATION_FAILED';

export interface ServiceError {
	code: ServiceErrorCode;
	message: string;
}

export type GenerationStage = 'queued' | 'loading_model' | 'generating' | 'encoding';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

// 결과 바이트는 GET /jobs/{jobId}/result 로 받는다. 여기는 메타데이터만.
export type GenerateResult =
	| { kind: 'audio'; durationSec: number; suggestedLengthBeats: number }
	| { kind: 'midi'; lengthBeats: number };

// GET /jobs/{jobId} 상태 스냅샷 — WS 단절 후 복구용
export interface GenerateJob {
	jobId: string; // 'job_' 접두사
	status: JobStatus;
	progress?: number; // 0..1, 없으면 indeterminate
	stage?: GenerationStage;
	result?: GenerateResult; // status가 'succeeded'일 때만
	error?: ServiceError; // status가 'failed'일 때만
}

export interface CancelResponse {
	jobId: string;
	status: 'cancelling' | 'already_finished'; // 멱등 — 종료된 job이면 no-op
}

// WS /ws/jobs/{jobId} 서비스 → 렌더러 메시지
export type JobWsMessage =
	| { type: 'progress'; jobId: string; progress?: number; stage: GenerationStage }
	| { type: 'succeeded'; jobId: string; result: GenerateResult }
	| { type: 'failed'; jobId: string; error: ServiceError }
	| { type: 'cancelled'; jobId: string };
