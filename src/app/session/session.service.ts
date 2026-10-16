import { Injectable, inject, signal } from '@angular/core';
import { BeatEvent } from '../core/beat-event';
import { ValidSettings } from '../core/ramp';
import { DEFAULT_SETTINGS, Settings, validate } from '../core/settings';
import { SESSION_PLATFORM, SessionAudioContext, SessionScheduler } from './session-platform';

export type SessionStatus = 'idle' | 'playing';

export const MSG_NO_AUDIO = 'No audio output available';

/**
 * Owns Settings, the count-in switch and the running Session.
 * Only `updateSettings`, `setCountIn`, `start` and `stop` mutate.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly platform = inject(SESSION_PLATFORM);

  private readonly _settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  private readonly _status = signal<SessionStatus>('idle');
  private readonly _current = signal<BeatEvent | null>(null);
  private readonly _audioError = signal<string | null>(null);
  private readonly _countIn = signal(true);

  readonly settings = this._settings.asReadonly();
  readonly status = this._status.asReadonly();
  readonly current = this._current.asReadonly();
  readonly audioError = this._audioError.asReadonly();
  /** Whether a Session starts with a one-bar count-in. On at launch, not persisted. */
  readonly countIn = this._countIn.asReadonly();

  private ctx: SessionAudioContext | null = null;
  private scheduler: SessionScheduler | null = null;
  private queue: BeatEvent[] = [];
  private frame: number | null = null;
  /** Bumped on every start/stop so a stale async start cannot begin playback. */
  private generation = 0;

  /** Replaces Settings. Ignored while playing. */
  updateSettings(settings: Settings): void {
    if (this._status() === 'playing') {
      return;
    }
    this._settings.set({ ...settings });
    this._audioError.set(null);
  }

  /** Switches the count-in on or off. Ignored while playing. */
  setCountIn(on: boolean): void {
    if (this._status() === 'playing') {
      return;
    }
    this._countIn.set(on);
  }

  /**
   * Starts a Session with the current Settings: an optional one-bar count-in at the Start BPM
   * (if `countIn` is on), then ramp bar 0. Resolves to true once playing;
   * false if Settings are invalid, it is already playing, or audio is unavailable.
   */
  async start(): Promise<boolean> {
    if (this._status() === 'playing') {
      return false;
    }
    const settings = this._settings();
    if (!validate(settings).ok) {
      return false;
    }
    const generation = ++this.generation;
    let ctx: SessionAudioContext;
    try {
      ctx = this.ctx ??= this.platform.createAudioContext();
      await ctx.resume();
    } catch {
      if (generation === this.generation) {
        this._audioError.set(MSG_NO_AUDIO);
      }
      return false;
    }
    if (generation !== this.generation || this._status() === 'playing') {
      return false;
    }
    this._audioError.set(null);
    this.scheduler ??= this.platform.createScheduler(ctx);
    this.queue = [];
    this._current.set(null);
    this._status.set('playing');
    this.scheduler.start(settings as ValidSettings, (event) => this.enqueue(event), {
      countIn: this._countIn(),
    });
    this.frame = this.platform.requestAnimationFrame(() => this.publish());
    return true;
  }

  /** Stops the Session. Settings are kept. */
  stop(): void {
    this.generation++;
    // Release the audio device; a later start() resumes it.
    this.ctx?.suspend().catch(() => undefined);
    if (this._status() !== 'playing') {
      return;
    }
    this.scheduler?.stop();
    if (this.frame !== null) {
      this.platform.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.queue = [];
    this._current.set(null);
    this._status.set('idle');
  }

  /** Audio-clock time of what is currently leaving the speakers. */
  private audibleTime(): number {
    return this.ctx ? this.ctx.currentTime - (this.ctx.outputLatency ?? 0) : 0;
  }

  /** Queues an event, dropping already-sounded ones except the latest so the queue stays bounded. */
  private enqueue(event: BeatEvent): void {
    const now = this.audibleTime();
    while (this.queue.length > 1 && this.queue[1].audioTime <= now) {
      this.queue.shift();
    }
    this.queue.push({ ...event });
  }

  /** The single rAF loop: publishes the latest event that has sounded. */
  private publish(): void {
    this.frame = null;
    if (this._status() !== 'playing' || !this.ctx) {
      return;
    }
    const now = this.audibleTime();
    let latest: BeatEvent | null = null;
    while (this.queue.length > 0 && this.queue[0].audioTime <= now) {
      latest = this.queue.shift()!;
    }
    if (latest) {
      this._current.set(latest);
    }
    this.frame = this.platform.requestAnimationFrame(() => this.publish());
  }
}
