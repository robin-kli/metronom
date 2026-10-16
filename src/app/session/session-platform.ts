import { InjectionToken } from '@angular/core';
import { AudioClock, Scheduler, SchedulerOptions } from '../audio/scheduler';
import { BeatEvent } from '../core/beat-event';
import { ValidSettings } from '../core/ramp';

/** An AudioContext as the session sees it. */
export interface SessionAudioContext extends AudioClock {
  /** Seconds between scheduling a sound and it leaving the speakers, if the browser reports it. */
  readonly outputLatency?: number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
}

export interface SessionScheduler {
  start(
    settings: ValidSettings,
    onBeat: (event: BeatEvent) => void,
    options?: SchedulerOptions,
  ): void;
  stop(): void;
}

/** Browser services the session needs; replaced with fakes in tests. */
export interface SessionPlatform {
  createAudioContext(): SessionAudioContext;
  createScheduler(ctx: SessionAudioContext): SessionScheduler;
  requestAnimationFrame(fn: () => void): number;
  cancelAnimationFrame(handle: number): void;
}

export const SESSION_PLATFORM = new InjectionToken<SessionPlatform>('SESSION_PLATFORM', {
  providedIn: 'root',
  factory: (): SessionPlatform => ({
    createAudioContext: () => new AudioContext(),
    createScheduler: (ctx) => new Scheduler(ctx as unknown as AudioContext),
    requestAnimationFrame: (fn) => requestAnimationFrame(fn),
    cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
  }),
});
