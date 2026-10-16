import { BeatEvent } from '../core/beat-event';
import { rampAt, ValidSettings } from '../core/ramp';
import { ClickHandle, scheduleClick } from './click';

/** How often the scheduler wakes up (ms). */
export const TICK_MS = 25;
/** How far ahead of `currentTime` beats are scheduled (s). */
export const LOOKAHEAD_S = 0.1;
/** Delay before the first beat, so it is never scheduled in the past (s). */
export const START_DELAY_S = 0.05;
export const BEATS_PER_BAR = 4;

/** The part of `AudioContext` the scheduler reads. */
export interface AudioClock {
  readonly currentTime: number;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type ClickFn<C extends AudioClock> = (
  ctx: C,
  time: number,
  accent: boolean,
  countIn: boolean,
) => ClickHandle;

export interface SchedulerOptions {
  /** Play one bar of four count-in beats at the Start BPM before ramp bar 0. */
  countIn?: boolean;
}

const browserTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Look-ahead scheduler: every ~25 ms it schedules all beats falling within the next ~100 ms
 * on the audio clock. Beat times accumulate `60 / tempo`; tempo comes only from `rampAt()`
 * per Bar, so it can only change on beat 1. An optional count-in bar at the Start BPM precedes
 * ramp bar 0 and never counts towards the ramp.
 */
export class Scheduler<C extends AudioClock = BaseAudioContext> {
  private timer: unknown = null;
  private running = false;
  private settings: ValidSettings | null = null;
  private onBeat: (event: BeatEvent) => void = () => undefined;
  private nextTime = 0;
  private barIndex = 0;
  private beat = 1;
  private inCountIn = false;
  private pending: { time: number; click: ClickHandle }[] = [];

  constructor(
    private readonly ctx: C,
    private readonly timers: Timers = browserTimers,
    private readonly click: ClickFn<C> = scheduleClick as unknown as ClickFn<C>,
  ) {}

  /** Starts at bar 0, beat 1 (or the count-in, if enabled), shortly after the current audio time. */
  start(
    settings: ValidSettings,
    onBeat: (event: BeatEvent) => void,
    options: SchedulerOptions = {},
  ): void {
    this.stop();
    this.settings = settings;
    this.onBeat = onBeat;
    this.nextTime = this.ctx.currentTime + START_DELAY_S;
    this.barIndex = 0;
    this.beat = 1;
    this.inCountIn = options.countIn ?? false;
    this.running = true;
    this.tick();
  }

  /** Halts scheduling and silences clicks scheduled but not yet sounded. */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
    const now = this.ctx.currentTime;
    for (const { time, click } of this.pending) {
      if (time > now) {
        click.cancel();
      }
    }
    this.pending = [];
  }

  private tick(): void {
    this.timer = null;
    if (!this.running || !this.settings) {
      return;
    }
    const now = this.ctx.currentTime;
    this.pending = this.pending.filter((p) => p.time > now);
    // After a late tick, skip beats already in the past (no burst), keeping bar counting intact.
    while (this.nextTime < now) {
      this.nextTime += 60 / this.currentBeat(this.settings).tempo;
      this.advanceBeat();
    }
    const horizon = now + LOOKAHEAD_S;
    while (this.nextTime < horizon) {
      const event = this.currentBeat(this.settings);
      const tempo = event.tempo;
      this.pending.push({
        time: this.nextTime,
        click: this.click(this.ctx, this.nextTime, this.beat === 1, this.inCountIn),
      });
      this.onBeat(event);
      this.nextTime += 60 / tempo;
      this.advanceBeat();
    }
    this.timer = this.timers.setTimeout(() => this.tick(), TICK_MS);
  }

  /** The BeatEvent for the beat at `nextTime`. */
  private currentBeat(settings: ValidSettings): BeatEvent {
    if (this.inCountIn) {
      return {
        audioTime: this.nextTime,
        beat: this.beat,
        barIndex: -1,
        tempo: settings.startBpm,
        hold: false,
        barsToNext: 0,
        countIn: true,
      };
    }
    const { tempo, hold, barsToNext } = rampAt(settings, this.barIndex);
    return {
      audioTime: this.nextTime,
      beat: this.beat,
      barIndex: this.barIndex,
      tempo,
      hold,
      barsToNext,
      countIn: false,
    };
  }

  private advanceBeat(): void {
    if (this.beat === BEATS_PER_BAR) {
      this.beat = 1;
      if (this.inCountIn) {
        // The count-in bar is over; ramp bar 0 follows (barIndex is still 0).
        this.inCountIn = false;
      } else {
        this.barIndex++;
      }
    } else {
      this.beat++;
    }
  }
}
