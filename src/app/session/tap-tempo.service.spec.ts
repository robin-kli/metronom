import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS } from '../core/settings';
import { SESSION_PLATFORM, SessionPlatform } from './session-platform';
import { SessionService } from './session.service';
import { TAP_CLOCK, TapTempoService } from './tap-tempo.service';

describe('TapTempoService', () => {
  let clock: number;
  let session: SessionService;
  let tap: TapTempoService;

  const tapAt = (...times: number[]) => {
    for (const t of times) {
      vi.advanceTimersByTime(t - clock);
      clock = t;
      tap.tap();
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    const platform: SessionPlatform = {
      createAudioContext: () => ({
        currentTime: 0,
        resume: async () => undefined,
        suspend: async () => undefined,
      }),
      createScheduler: () => ({ start: () => undefined, stop: () => undefined }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_PLATFORM, useValue: platform },
        { provide: TAP_CLOCK, useValue: () => clock },
      ],
    });
    session = TestBed.inject(SessionService);
    tap = TestBed.inject(TapTempoService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts empty', () => {
    expect(tap.bpm()).toBeNull();
    expect(tap.count()).toBe(0);
    expect(tap.announcement()).toBe('');
  });

  it('a single tap shows the placeholder and leaves Start alone', () => {
    tapAt(0);
    expect(tap.count()).toBe(1);
    expect(tap.bpm()).toBeNull();
    expect(session.settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('averages all taps and writes Start live from the second tap', () => {
    tapAt(0, 600);
    expect(tap.bpm()).toBe(100);
    expect(session.settings().startBpm).toBe(100);
    tapAt(1000, 1500);
    expect(tap.bpm()).toBe(120);
    expect(tap.count()).toBe(4);
    expect(session.settings().startBpm).toBe(120);
  });

  it('five taps 500 ms apart give 120 and "5 taps"', () => {
    tapAt(0, 500, 1000, 1500, 2000);
    expect(tap.bpm()).toBe(120);
    expect(tap.count()).toBe(5);
    expect(session.settings().startBpm).toBe(120);
  });

  it('drops an outlier but counts its tap', () => {
    tapAt(0, 500, 1000, 1500, 2000, 2900);
    expect(tap.bpm()).toBe(120);
    expect(tap.count()).toBe(6);
  });

  it('raises the Ceiling in Ramp mode, never below its value before the run', () => {
    session.updateSettings({ startBpm: 60, ceilingBpm: 120, step: 5, interval: 4 });
    tapAt(0, 400);
    expect(session.settings()).toEqual({ startBpm: 150, ceilingBpm: 150, step: 5, interval: 4 });
    tapAt(1000);
    expect(session.settings()).toEqual({ startBpm: 120, ceilingBpm: 120, step: 5, interval: 4 });
  });

  it('leaves the hidden Ceiling alone in constant mode', () => {
    session.setRamp(false);
    tapAt(0, 400);
    expect(session.settings()).toEqual({ ...DEFAULT_SETTINGS, startBpm: 150 });
  });

  it('a pause over 2.5 s starts a new run', () => {
    tapAt(0, 500, 1000);
    tapAt(3600);
    expect(tap.count()).toBe(1);
    expect(tap.bpm()).toBeNull();
    expect(session.settings().startBpm).toBe(120);
    tapAt(4100);
    expect(tap.count()).toBe(2);
    expect(tap.bpm()).toBe(120);
  });

  it('announces once, 2.5 s after the last tap of a run of two or more', () => {
    tapAt(0, 500, 1000);
    vi.advanceTimersByTime(2499);
    expect(tap.announcement()).toBe('');
    vi.advanceTimersByTime(1);
    expect(tap.announcement()).toBe('Tapped 120 BPM');
    // The readout stays until the next run begins.
    expect(tap.bpm()).toBe(120);
    expect(tap.count()).toBe(3);
  });

  it('a new run clears the announcement and a later tap starts fresh', () => {
    tapAt(0, 500);
    vi.advanceTimersByTime(2500);
    clock = 3000;
    expect(tap.announcement()).toBe('Tapped 120 BPM');
    tap.tap();
    expect(tap.announcement()).toBe('');
    expect(tap.count()).toBe(1);
  });

  it('a single-tap run says nothing', () => {
    tapAt(0);
    vi.advanceTimersByTime(5000);
    expect(tap.announcement()).toBe('');
  });

  it('ignores taps while playing and ends the run on start', async () => {
    tapAt(0, 500);
    await session.start();
    TestBed.tick();
    expect(tap.bpm()).toBeNull();
    expect(tap.count()).toBe(0);
    const before = tap.lastTap();
    tapAt(1000, 1500);
    expect(tap.count()).toBe(0);
    expect(tap.lastTap()).toBe(before);
    vi.advanceTimersByTime(5000);
    expect(tap.announcement()).toBe('');
    session.stop();
    tapAt(10000);
    expect(tap.count()).toBe(1);
  });

  it('bumps lastTap on every tap', () => {
    tapAt(0, 500, 1000);
    expect(tap.lastTap()).toBe(3);
  });

  it('ignores a tap less than 100 ms after the previous one', () => {
    tapAt(0, 500);
    const before = tap.lastTap();
    tapAt(510);
    expect(tap.count()).toBe(2);
    expect(tap.bpm()).toBe(120);
    expect(tap.lastTap()).toBe(before);
    expect(session.settings().startBpm).toBe(120);
    tapAt(1000);
    expect(tap.count()).toBe(3);
    expect(tap.bpm()).toBe(120);
  });

  it('applies each estimate against the Ceiling from before the run', () => {
    session.updateSettings({ startBpm: 60, ceilingBpm: 120, step: 5, interval: 4 });
    tapAt(0, 400);
    expect(session.settings()).toMatchObject({ startBpm: 150, ceilingBpm: 150 });
    tapAt(1200);
    expect(session.settings()).toMatchObject({ startBpm: 100, ceilingBpm: 120 });
  });
});
