// project.json 스키마의 TypeScript 정의.
// 변경 시 service/app/api/schemas.py 와 docs/api/project-schema.md 를 같은 커밋에서 갱신한다.

export const PROJECT_SCHEMA_VERSION = 1;

export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export interface MusicalKey {
	tonic: PitchClass;
	mode: 'major' | 'minor';
}

export interface TimeSignature {
	numerator: number;
	denominator: 1 | 2 | 4 | 8 | 16;
}

export type TrackKind = 'audio' | 'midi';

export interface Track {
	id: string; // 'trk_' 접두사
	name: string;
	kind: TrackKind;
	volume: number; // linear gain, 1 = unity (dB 변환은 UI 관심사)
	pan: number; // -1(L) .. 1(R) — StereoPannerNode 값 그대로
	mute: boolean;
	solo: boolean;
}

export interface ClipOrigin {
	source: 'user' | 'ai';
	jobId?: string; // source가 'ai'일 때 생성 job 추적용
	prompt?: string;
}

export interface AudioClipMedia {
	kind: 'audio';
	path: string; // 프로젝트 폴더 기준 상대경로 (예: 'audio/clp_x1y2z3.wav')
	durationSec: number; // 디코드 없이 레이아웃 계산용 캐시 — 진실은 파일 헤더
}

export interface MidiClipMedia {
	kind: 'midi';
	path: string; // 예: 'midi/clp_m4n5o6.mid'
}

export type ClipMedia = AudioClipMedia | MidiClipMedia;

export interface Clip {
	id: string; // 'clp_' 접두사
	trackId: string; // media.kind 는 참조 트랙의 kind 와 일치해야 한다 (로드 시 검증)
	name: string;
	startBeat: number; // 타임라인 위치는 beat — BPM 변경에도 음악적 위치 불변
	lengthBeats: number; // 그리드 점유 길이. 타임스트레치 없는 MVP에서는 오디오 실길이와 어긋날 수 있다
	media: ClipMedia;
	origin: ClipOrigin;
}

export interface Project {
	schemaVersion: typeof PROJECT_SCHEMA_VERSION;
	name: string;
	bpm: number;
	timeSignature: TimeSignature;
	key: MusicalKey | null; // 미지정 허용 — 분석 결과로 채울 수 있다
	tracks: Track[];
	clips: Clip[]; // 평탄 구조 — 트랙 이동은 trackId 한 필드 변경
	createdAt: string; // ISO 8601
	updatedAt: string;
}
