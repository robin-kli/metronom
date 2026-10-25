import { effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { applyTap, TAP_MIN_GAP_MS, TAP_RESET_MS, tapBpm } from '../core/tap-tempo';
import { SessionService } from './session.service';

/** Monotonic milliseconds for tap timing; replaced in tests. */
export const TAP_CLOCK = new InjectionToken<() => number>('TAP_CLOCK', {
  providedIn: 'root',
  factory: () => () => performance.now(),
});

/**
 * Tap tempo: collects the taps of the current run and writes the measured tempo live into
 * Start BPM (Tempo BPM) through SessionService from the second tap. Idle only.
 */
@Injectable({ providedIn: 'root' })
export class TapTempoService {
  private readonly session = inject(SessionService);
  private readonly now = inject(TAP_CLOCK);

  private readonly _bpm = signal<number | null>(null);
  private readonly _count = signal(0);
  private readonly _announcement = signal('');
  private readonly _lastTap = signal(0);

  /** The run's tempo, or null before its second tap. */
  readonly bpm = this._bpm.asReadonly();
  /** Taps in the current run, including dropped outliers. */
  readonly count = this._count.asReadonly();
  /** Polite live-region text, set once when a run of two or more taps ends. */
  readonly announcement = this._announcement.asReadonly();
  /** Bumped on every accepted tap, so the Tap button can flash for mouse and key alike. */
  readonly lastTap = this._lastTap.asReadonly();

  /** Tap times (ms) of the current run; empty when no run is open. */
  private times: number[] = [];
  /** Ceiling BPM at the run's first tap; each estimate is applied against it. */
  private baselineCeiling: number | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Leaving Idle ends the run; Stop comes back to an empty readout.
    effect(() => {
      if (this.session.status() === 'playing') {
        this.reset();
      }
    });
  }

  /** One tap. Ignored while playing. */
  tap(): void {
    if (this.session.status() === 'playing') {
      return;
    }
    const now = this.now();
    const last = this.times.at(-1);
    if (last !== undefined && now - last < TAP_MIN_GAP_MS) {
      // A double hit (pointer press plus T, or a bounce): ignore it entirely.
      return;
    }
    if (last === undefined || now - last > TAP_RESET_MS) {
      this.times = [];
      this._announcement.set('');
      this.baselineCeiling = this.session.settings().ceilingBpm;
    }
    this.times.push(now);
    this._count.set(this.times.length);
    this._lastTap.update((n) => n + 1);

    const intervals = this.times.slice(1).map((t, i) => t - this.times[i]);
    const bpm = tapBpm(intervals);
    this._bpm.set(bpm);
    if (bpm !== null) {
      // Against the run's starting Ceiling, so a noisy early estimate doesn't ratchet it up.
      const base = { ...this.session.settings(), ceilingBpm: this.baselineCeiling };
      this.session.updateSettings(applyTap(base, bpm, this.session.ramp()));
    }

    this.clearTimer();
    this.endTimer = setTimeout(() => this.endRun(), TAP_RESET_MS);
  }

  /** The pause after the last tap has passed: announce once, and the next tap starts a new run. */
  private endRun(): void {
    this.endTimer = null;
    const bpm = this._bpm();
    if (this.times.length >= 2 && bpm !== null) {
      this._announcement.set(`Tapped ${bpm} BPM`);
    }
    this.times = [];
  }

  private reset(): void {
    this.clearTimer();
    this.times = [];
    this._bpm.set(null);
    this._count.set(0);
    this._announcement.set('');
  }

  private clearTimer(): void {
    if (this.endTimer !== null) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
  }
}
