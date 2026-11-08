import { TestBed } from '@angular/core/testing';
import { BeatEvent } from '../core/beat-event';
import { SchedulerOptions } from '../audio/scheduler';
import { ValidSettings } from '../core/ramp';
import { DEFAULT_SETTINGS } from '../core/settings';
import {
  SESSION_PLATFORM,
  SessionAudioContext,
  SessionPlatform,
  SessionScheduler,
} from './session-platform';
import { MSG_NO_AUDIO, SessionService } from './session.service';

class FakeContext implements SessionAudioContext {
  currentTime = 0;
  outputLatency = 0;
  resumes = 0;
  suspends = 0;
  failResume = false;
  async resume(): Promise<void> {
    this.resumes++;
    if (this.failResume) throw new Error('no device');
  }
  async suspend(): Promise<void> {
    this.suspends++;
  }
}

class FakeScheduler implements SessionScheduler {
  starts: ValidSettings[] = [];
  options: (SchedulerOptions | undefined)[] = [];
  updates: ValidSettings[] = [];
  stops = 0;
  onBeat: ((e: BeatEvent) => void) | null = null;
  start(settings: ValidSettings, onBeat: (e: BeatEvent) => void, options?: SchedulerOptions): void {
    this.starts.push(settings);
    this.options.push(options);
    this.onBeat = onBeat;
  }
  update(settings: ValidSettings): void {
    this.updates.push(settings);
  }
  stop(): void {
    this.stops++;
    this.onBeat = null;
  }
  emit(audioTime: number, beat: number, barIndex = 0, tempo = 60, countIn = false): void {
    this.onBeat?.({ audioTime, beat, barIndex, tempo, hold: false, barsToNext: 4, countIn });
  }
}

describe('SessionService', () => {
  let ctx: FakeContext;
  let scheduler: FakeScheduler;
  let frames: Map<number, () => void>;
  let createContext: () => SessionAudioContext;
  let service: SessionService;

  const runFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn());
  };

  beforeEach(() => {
    ctx = new FakeContext();
    scheduler = new FakeScheduler();
    frames = new Map();
    let nextFrame = 1;
    createContext = () => ctx;
    const platform: SessionPlatform = {
      createAudioContext: () => createContext(),
      createScheduler: () => scheduler,
      requestAnimationFrame: (fn) => {
        const id = nextFrame++;
        frames.set(id, fn);
        return id;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_PLATFORM, useValue: platform }],
    });
    service = TestBed.inject(SessionService);
  });

  it('starts idle with the default settings', () => {
    expect(service.status()).toBe('idle');
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.current()).toBeNull();
    expect(service.audioError()).toBeNull();
  });

  it('starts playing at bar 0 with the current settings', async () => {
    service.updateSettings({ startBpm: 80, ceilingBpm: 100, step: 4, interval: 2 });
    expect(await service.start()).toBe(true);
    expect(service.status()).toBe('playing');
    expect(ctx.resumes).toBe(1);
    expect(scheduler.starts).toEqual([{ startBpm: 80, ceilingBpm: 100, step: 4, interval: 2 }]);
  });

  it('has the count-in on by default and passes it to the scheduler', async () => {
    expect(service.countIn()).toBe(true);
    await service.start();
    expect(scheduler.options).toEqual([{ countIn: true }]);
  });

  it('passes count-in off to the scheduler once switched off', async () => {
    service.setCountIn(false);
    expect(service.countIn()).toBe(false);
    await service.start();
    expect(scheduler.options).toEqual([{ countIn: false }]);
  });

  it('ignores setCountIn while playing', async () => {
    await service.start();
    service.setCountIn(false);
    expect(service.countIn()).toBe(true);
  });

  it('accepts setCountIn again after stop', async () => {
    await service.start();
    service.stop();
    service.setCountIn(false);
    expect(service.countIn()).toBe(false);
  });

  it('stop during the count-in returns to idle and keeps the count-in setting', async () => {
    await service.start();
    scheduler.emit(0.05, 1, -1, 60, true);
    scheduler.emit(1.05, 2, -1, 60, true);
    ctx.currentTime = 1.1;
    runFrame();
    expect(service.current()).toMatchObject({ beat: 2, countIn: true });
    service.stop();
    expect(service.status()).toBe('idle');
    expect(service.current()).toBeNull();
    expect(scheduler.stops).toBe(1);
    expect(service.countIn()).toBe(true);
  });

  it('refuses invalid settings and stays idle', async () => {
    service.updateSettings({ ...DEFAULT_SETTINGS, ceilingBpm: 10 });
    expect(await service.start()).toBe(false);
    expect(service.status()).toBe('idle');
    expect(scheduler.starts.length).toBe(0);
    expect(ctx.resumes).toBe(0);
  });

  it('ignores updateSettings while playing', async () => {
    await service.start();
    service.updateSettings({ startBpm: 90, ceilingBpm: 90, step: 1, interval: 1 });
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('stop keeps settings, returns to idle and clears the current beat', async () => {
    const custom = { startBpm: 70, ceilingBpm: 140, step: 7, interval: 3 };
    service.updateSettings(custom);
    await service.start();
    scheduler.emit(0.05, 1);
    ctx.currentTime = 0.06;
    runFrame();
    expect(service.current()).not.toBeNull();
    service.stop();
    expect(service.status()).toBe('idle');
    expect(service.settings()).toEqual(custom);
    expect(service.current()).toBeNull();
    expect(scheduler.stops).toBe(1);
    expect(frames.size).toBe(0);
  });

  it('starts again at bar 0 after a stop, resuming the same AudioContext', async () => {
    let created = 0;
    createContext = () => {
      created++;
      return ctx;
    };
    await service.start();
    service.stop();
    await service.start();
    expect(created).toBe(1);
    expect(ctx.resumes).toBe(2);
    expect(scheduler.starts.length).toBe(2);
    expect(service.status()).toBe('playing');
  });

  it('publishes the latest event whose audio time has passed, once per frame', async () => {
    await service.start();
    scheduler.emit(0.05, 1);
    scheduler.emit(0.55, 2);
    scheduler.emit(1.05, 3);

    ctx.currentTime = 0.01;
    runFrame();
    expect(service.current()).toBeNull();

    ctx.currentTime = 0.6;
    runFrame();
    expect(service.current()?.beat).toBe(2);

    ctx.currentTime = 0.9;
    runFrame();
    expect(service.current()?.beat).toBe(2);

    ctx.currentTime = 1.05;
    runFrame();
    expect(service.current()?.beat).toBe(3);
    expect(frames.size).toBe(1);
  });

  it('stays idle and reports no audio when resume rejects', async () => {
    ctx.failResume = true;
    expect(await service.start()).toBe(false);
    expect(service.status()).toBe('idle');
    expect(service.audioError()).toBe(MSG_NO_AUDIO);
    expect(scheduler.starts.length).toBe(0);
  });

  it('stays idle and reports no audio when the AudioContext cannot be created', async () => {
    createContext = () => {
      throw new Error('unsupported');
    };
    expect(await service.start()).toBe(false);
    expect(service.status()).toBe('idle');
    expect(service.audioError()).toBe(MSG_NO_AUDIO);
  });

  it('clears the audio error once a start succeeds', async () => {
    ctx.failResume = true;
    await service.start();
    ctx.failResume = false;
    expect(await service.start()).toBe(true);
    expect(service.audioError()).toBeNull();
  });

  it('does not begin playback if stopped while resuming', async () => {
    const pending = service.start();
    service.stop();
    expect(await pending).toBe(false);
    expect(service.status()).toBe('idle');
    expect(scheduler.starts.length).toBe(0);
  });

  it('clears the audio error when settings are edited', async () => {
    ctx.failResume = true;
    await service.start();
    expect(service.audioError()).toBe(MSG_NO_AUDIO);
    service.updateSettings({ ...DEFAULT_SETTINGS, step: 6 });
    expect(service.audioError()).toBeNull();
  });

  it('suspends the AudioContext on stop', async () => {
    await service.start();
    service.stop();
    expect(ctx.suspends).toBe(1);
  });

  it('publishes against the audible time, accounting for output latency', async () => {
    ctx.outputLatency = 0.1;
    await service.start();
    scheduler.emit(0.5, 1);
    ctx.currentTime = 0.55;
    runFrame();
    expect(service.current()).toBeNull();
    ctx.currentTime = 0.6;
    runFrame();
    expect(service.current()?.beat).toBe(1);
  });

  it('keeps the queue bounded while frames are paused', async () => {
    await service.start();
    for (let i = 0; i < 1000; i++) {
      ctx.currentTime = i * 0.5;
      scheduler.emit(i * 0.5, (i % 4) + 1, Math.floor(i / 4));
    }
    expect((service as unknown as { queue: unknown[] }).queue.length).toBeLessThanOrEqual(2);
    runFrame();
    expect(service.current()?.audioTime).toBe(999 * 0.5);
  });
  describe('ramp switch', () => {
    it('is on by default', () => {
      expect(service.ramp()).toBe(true);
    });

    it('with Ramp off, plays every bar at Start even with an empty hidden Ceiling', async () => {
      service.setRamp(false);
      service.updateSettings({ startBpm: 90, ceilingBpm: null, step: 5, interval: 4 });
      expect(await service.start()).toBe(true);
      expect(scheduler.starts).toEqual([{ startBpm: 90, ceilingBpm: 90, step: 5, interval: 4 }]);
      // Settings themselves are untouched.
      expect(service.settings().ceilingBpm).toBeNull();
    });

    it('with Ramp off, refuses to start with an empty Tempo', async () => {
      service.setRamp(false);
      service.updateSettings({ startBpm: null, ceilingBpm: 120, step: 5, interval: 4 });
      expect(await service.start()).toBe(false);
      expect(scheduler.starts).toEqual([]);
    });

    it('switching Ramp back on raises a Ceiling below Start', () => {
      service.setRamp(false);
      service.updateSettings({ startBpm: 150, ceilingBpm: 120, step: 5, interval: 4 });
      service.setRamp(true);
      expect(service.ramp()).toBe(true);
      expect(service.settings()).toEqual({ startBpm: 150, ceilingBpm: 150, step: 5, interval: 4 });
    });

    it('switching Ramp off keeps all values', () => {
      service.setRamp(false);
      expect(service.ramp()).toBe(false);
      expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    });

    it('ignores setRamp while playing', async () => {
      await service.start();
      service.setRamp(false);
      expect(service.ramp()).toBe(true);
    });
  });

  describe('nudge', () => {
    it('while idle shifts Start and Ceiling, and the Tempo only with Ramp off', () => {
      service.nudge(1);
      expect(service.settings()).toEqual({ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 });
      service.setRamp(false);
      service.nudge(-1);
      expect(service.settings()).toEqual({ startBpm: 60, ceilingBpm: 121, step: 5, interval: 4 });
      expect(scheduler.updates).toEqual([]);
    });

    it('while playing updates the running scheduler without restarting', async () => {
      await service.start();
      scheduler.emit(0.05, 1, 5);
      service.nudge(1);
      expect(service.status()).toBe('playing');
      expect(service.settings()).toEqual({ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 });
      expect(scheduler.updates).toEqual([{ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 }]);
      expect(scheduler.starts).toHaveLength(1);
      expect(scheduler.stops).toBe(0);
    });

    it('while playing with Ramp off plays the new Tempo steadily', async () => {
      service.updateSettings({ startBpm: 90, ceilingBpm: null, step: null, interval: 4 });
      service.setRamp(false);
      await service.start();
      service.nudge(-1);
      expect(service.settings()).toEqual({
        startBpm: 89,
        ceilingBpm: null,
        step: null,
        interval: 4,
      });
      expect(scheduler.updates).toEqual([{ startBpm: 89, ceilingBpm: 89, step: 1, interval: 4 }]);
    });

    it('never drops Start below 1, idle or playing', async () => {
      service.updateSettings({ startBpm: 1, ceilingBpm: 40, step: 5, interval: 4 });
      service.nudge(-1);
      expect(service.settings().startBpm).toBe(1);
      await service.start();
      service.nudge(-1);
      expect(service.settings().startBpm).toBe(1);
      expect(scheduler.updates).toEqual([]);
    });

    it('updateSettings stays refused while playing', async () => {
      await service.start();
      service.nudge(1);
      service.updateSettings({ startBpm: 10, ceilingBpm: 20, step: 1, interval: 1 });
      expect(service.settings().startBpm).toBe(61);
    });

    it('a nudge while resume() is pending is what the scheduler starts with', async () => {
      const starting = service.start();
      service.nudge(1);
      expect(await starting).toBe(true);
      expect(service.settings()).toEqual({ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 });
      expect(scheduler.starts).toEqual([{ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 }]);
    });

    it('after stop, nudges no longer reach the scheduler', async () => {
      await service.start();
      service.stop();
      service.nudge(1);
      expect(service.settings().startBpm).toBe(61);
      expect(scheduler.updates).toEqual([]);
    });
  });
});
