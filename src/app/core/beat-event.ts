/** One scheduled Beat, produced by the scheduler and published by SessionService when it sounds. */
export interface BeatEvent {
  /** AudioContext time (seconds) at which the click sounds. */
  audioTime: number;
  /** Beat within the Bar, 1–4. */
  beat: number;
  /** Bar index since Start, from 0. */
  barIndex: number;
  /** Tempo of this Bar in BPM. */
  tempo: number;
  hold: boolean;
  barsToNext: number;
}
