// transport 모듈 싱글턴 — 앱에 정확히 1개, AudioContext 싱글턴에 종속.
// zustand를 모른다. 상태 동기화는 app 레이어(useTransportStore 액션)가 담당한다.
// 모듈 스코프 원시값만 사용 — rAF 경로(getPositionBeats)에서 할당 없음.

import { getAudioContext } from './audioContext';
import { clampBpm, ctxTimeAtBeat, positionBeatsAt, DEFAULT_BPM } from './transportMath';
import { startMetronome, stopMetronome } from './metronome';

let bpm = DEFAULT_BPM;
let playing = false;
let playPending = false; // resume 대기 중 재진입 가드
let playEpoch = 0; // resume 대기 중 stop()이 pending play를 무효화하기 위한 세대 카운터
let anchorCtxTime = 0;
let anchorBeats = 0;
let stoppedBeats = 0;

function beatToCtxTime(beat: number): number {
	return ctxTimeAtBeat(beat, anchorCtxTime, anchorBeats, bpm);
}

/** 실제로 재생이 시작됐을 때만 true — 재진입 조기 반환·pending 중 stop과 구분된다 */
export async function play(): Promise<boolean> {
	if (playing || playPending) return false;
	playPending = true;
	const epoch = ++playEpoch;
	try {
		const ctx = getAudioContext();
		// autoplay 정책: 사용자 제스처 핸들러에서 호출되어야 resume이 성공한다.
		// suspended 동안 currentTime이 멈춰 있으므로 anchor는 resume "이후" 시각으로 잡는다.
		if (ctx.state !== 'running') await ctx.resume();
		if (epoch !== playEpoch) return false; // resume 대기 중 stop() 호출됨
		anchorCtxTime = ctx.currentTime;
		anchorBeats = stoppedBeats;
		playing = true;
		startMetronome(anchorBeats, beatToCtxTime);
		return true;
	} finally {
		playPending = false;
	}
}

export function stop(): void {
	playEpoch += 1; // pending play 취소
	if (!playing) return;
	playing = false;
	stoppedBeats = 0; // DAW 관례: stop = 곡 처음으로 (pause는 범위 밖)
	stopMetronome();
}

export function setBpm(next: number): void {
	const clamped = clampBpm(next);
	if (playing) {
		// 재기준화: 변경 시각의 위치를 구 bpm으로 확정해 새 anchor로 — 위치 연속, 기울기만 변경
		const now = getAudioContext().currentTime;
		anchorBeats = positionBeatsAt(now, anchorCtxTime, anchorBeats, bpm);
		anchorCtxTime = now;
	}
	bpm = clamped;
}

/** rAF에서 매 프레임 호출 — 숫자만 반환, 할당 없음 */
export function getPositionBeats(): number {
	if (!playing) return stoppedBeats;
	return positionBeatsAt(getAudioContext().currentTime, anchorCtxTime, anchorBeats, bpm);
}

export function getBpm(): number {
	return bpm;
}

export function isPlaying(): boolean {
	return playing;
}
