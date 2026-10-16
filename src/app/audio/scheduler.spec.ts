import { ValidSettings } from '../core/ramp';
import { BeatEvent } from '../core/beat-event';
import { LOOKAHEAD_S, Scheduler, START_DELAY_S, TICK_MS, Timers } from './scheduler';

class FakeClock implements Timers {
  currentTime = 0;
  /** Extra audio-clock time, to simulate the audio clock running on while timers stall. */
  audioOffset = 0;
  private queue: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;
  private nowMs = 0;

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.queue.push({ at: this.nowMs + ms, fn, id });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.queue = this.queue.filter((t) => t.id !== handle);
  }

  get pendingTimers(): number {
    return this.queue.length;
  }

  /** Advances both the audio clock and the timer clock by `ms`, firing due timers in order. */
  advance(ms: number): void {
    const end = this.nowMs + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const next = this.queue[0];
      if (!next || next.at > end) break;
      this.queue.shift();
      this.nowMs = next.at;
      this.currentTime = this.nowMs / 1000 + this.audioOffset;
      next.fn();
    }
    this.nowMs = end;
    this.currentTime = end / 1000 + this.audioOffset;
  }
}

const settings = (
  startBpm: number,
  ceilingBpm: number,
  step: number,
  interval: number,
): ValidSettings => ({ startBpm, ceilingBpm, step, interval });

describe('Scheduler', () => {
  let clock: FakeClock;
  let clicks: { time: number; accent: boolean; countIn: boolean; cancelled: boolean }[];
  let beats: BeatEvent[];
  let scheduler: Scheduler<FakeClock>;

  beforeEach(() => {
    clock = new FakeClock();
    clicks = [];
    beats = [];
    scheduler = new Scheduler(clock, clock, (_ctx, time, accent, countIn) => {
      const click = { time, accent, countIn, cancelled: false };
      clicks.push(click);
      return { cancel: () => (click.cancelled = true) };
    });
  });

  const run = (s: ValidSettings, seconds: number) => {
    scheduler.start(s, (e) => beats.push(e));
    clock.advance(seconds * 1000);
  };

  it('schedules the first beat shortly after start and only within the look-ahead', () => {
    clock.advance(1000);
    scheduler.start(settings(60, 60, 5, 4), (e) => beats.push(e));
    expect(beats.length).toBe(1);
    expect(beats[0].audioTime).toBeCloseTo(1 + START_DELAY_S);
    expect(beats[0]).toMatchObject({ beat: 1, barIndex: 0, tempo: 60 });
  });

  it('spaces beats evenly at 60 / tempo', () => {
    run(settings(120, 120, 5, 4), 5);
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i].audioTime - beats[i - 1].audioTime).toBeCloseTo(0.5, 9);
    }
    expect(beats.length).toBeGreaterThan(8);
  });

  it('never schedules further ahead than the look-ahead', () => {
    scheduler.start(settings(240, 240, 5, 4), (e) => {
      expect(e.audioTime).toBeLessThan(clock.currentTime + LOOKAHEAD_S + 1e-9);
      beats.push(e);
    });
    clock.advance(3000);
    expect(beats.length).toBeGreaterThan(10);
  });

  it('counts beats 1–4 and bars, accenting beat 1', () => {
    run(settings(120, 120, 5, 4), 4.2);
    expect(beats.slice(0, 9).map((b) => [b.barIndex, b.beat])).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 1],
    ]);
    expect(clicks.slice(0, 5).map((c) => c.accent)).toEqual([true, false, false, false, true]);
    expect(clicks.map((c) => c.time)).toEqual(beats.map((b) => b.audioTime));
  });

  it('applies an increase on beat 1 of the next interval and holds at the ceiling', () => {
    // 60 / 72 / +6 / 1: one bar at 60, one at 66, then 72 and hold.
    run(settings(60, 72, 6, 1), 15);
    const firstOf = (bar: number) => beats.find((b) => b.barIndex === bar && b.beat === 1)!;
    expect(beats.filter((b) => b.barIndex === 0).every((b) => b.tempo === 60)).toBe(true);
    expect(beats.filter((b) => b.barIndex === 1).every((b) => b.tempo === 66)).toBe(true);
    expect(firstOf(2)).toMatchObject({ tempo: 72, hold: true });
    expect(beats.filter((b) => b.barIndex >= 2).every((b) => b.tempo === 72 && b.hold)).toBe(true);

    // The gap entering bar 1 is still 60 BPM (last beat of bar 0); after that it is 66.
    const t = (bar: number, beat: number) =>
      beats.find((b) => b.barIndex === bar && b.beat === beat)!.audioTime;
    expect(t(1, 1) - t(0, 4)).toBeCloseTo(1, 9);
    expect(t(1, 2) - t(1, 1)).toBeCloseTo(60 / 66, 9);
    expect(t(2, 1) - t(1, 4)).toBeCloseTo(60 / 66, 9);
    expect(t(2, 2) - t(2, 1)).toBeCloseTo(60 / 72, 9);
  });

  it('accumulates beat times without drift', () => {
    run(settings(60, 96, 6, 4), 120);
    // Sum of expected durations equals the last beat time.
    let expected = START_DELAY_S;
    for (let i = 0; i < beats.length; i++) {
      expect(beats[i].audioTime).toBeCloseTo(expected, 9);
      expected += 60 / beats[i].tempo;
    }
  });

  it('stop halts scheduling and cancels clicks not yet sounded', () => {
    run(settings(120, 120, 5, 4), 2);
    const count = beats.length;
    const future = clicks.filter((c) => c.time > clock.currentTime);
    scheduler.stop();
    expect(clock.pendingTimers).toBe(0);
    clock.advance(5000);
    expect(beats.length).toBe(count);
    expect(future.every((c) => c.cancelled)).toBe(true);
    expect(clicks.filter((c) => c.time <= 2).some((c) => c.cancelled)).toBe(false);
  });

  it('skips beats missed by a late tick instead of playing them as a burst', () => {
    run(settings(120, 120, 5, 1), 1);
    const before = clicks.length;
    // Advance the audio clock ~2.5 s (5 beats) without any tick firing.
    clock.audioOffset = 2.5;
    clock.advance(TICK_MS);
    const late = clicks.slice(before);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((c) => c.time >= clock.currentTime - TICK_MS / 1000)).toBe(true);
    // Beat/bar counting stays on the grid: still 0.5 s apart and beat follows bar position.
    const lateBeats = beats.slice(before);
    const prev = beats[before - 1];
    const skipped = Math.round((lateBeats[0].audioTime - prev.audioTime) / 0.5);
    expect(skipped).toBeGreaterThan(1);
    const index = (b: BeatEvent) => b.barIndex * 4 + b.beat - 1;
    expect(index(lateBeats[0]) - index(prev)).toBe(skipped);
  });

  it('restarts at bar 0 after a stop', () => {
    run(settings(60, 96, 6, 1), 10);
    scheduler.stop();
    beats = [];
    run(settings(60, 96, 6, 1), 0);
    expect(beats[0]).toMatchObject({ barIndex: 0, beat: 1, tempo: 60 });
  });

  describe('count-in', () => {
    const runWithCountIn = (s: ValidSettings, seconds: number) => {
      scheduler.start(s, (e) => beats.push(e), { countIn: true });
      clock.advance(seconds * 1000);
    };

    it('plays one bar of four count-in beats at the Start BPM before ramp bar 0', () => {
      // 60/96/+6/4: count-in at 60, ramp bars 0–3 at 60, bar 4 at 66.
      runWithCountIn(settings(60, 96, 6, 4), 30);
      expect(beats.slice(0, 4)).toEqual(
        [1, 2, 3, 4].map((beat, i) => ({
          audioTime: START_DELAY_S + i,
          beat,
          barIndex: -1,
          tempo: 60,
          hold: false,
          barsToNext: 0,
          countIn: true,
        })),
      );
      expect(clicks.slice(0, 4).map((c) => [c.accent, c.countIn])).toEqual([
        [true, true],
        [false, true],
        [false, true],
        [false, true],
      ]);
      const ramp = beats.slice(4);
      expect(ramp.every((b) => !b.countIn)).toBe(true);
      expect(clicks.slice(4).every((c) => !c.countIn)).toBe(true);
      expect(ramp[0]).toMatchObject({ beat: 1, barIndex: 0, tempo: 60, barsToNext: 4 });
      // Ramp bar 0 lands exactly one beat after count-in beat 4.
      expect(ramp[0].audioTime - beats[3].audioTime).toBeCloseTo(1, 9);
      expect(ramp.filter((b) => b.barIndex <= 3).every((b) => b.tempo === 60)).toBe(true);
      expect(ramp.find((b) => b.barIndex === 4 && b.beat === 1)?.tempo).toBe(66);
      expect(ramp.filter((b) => b.barIndex === 0).length).toBe(4);
    });

    it('starts straight on ramp bar 0 when off (current behaviour)', () => {
      scheduler.start(settings(60, 96, 6, 4), (e) => beats.push(e), { countIn: false });
      clock.advance(5000);
      expect(beats[0]).toMatchObject({
        audioTime: START_DELAY_S,
        beat: 1,
        barIndex: 0,
        countIn: false,
      });
      expect(beats.every((b) => !b.countIn)).toBe(true);
      expect(clicks.every((c) => !c.countIn)).toBe(true);
    });

    it('defaults to no count-in', () => {
      run(settings(60, 96, 6, 4), 2);
      expect(beats[0]).toMatchObject({ barIndex: 0, countIn: false });
    });

    it('skips beats missed by a late tick, keeping ramp bar 0 one beat after count-in beat 4', () => {
      runWithCountIn(settings(120, 120, 5, 4), 0);
      expect(beats.length).toBe(1);
      // Stall the timers while the audio clock runs past count-in beats 2–4 (1.5 s).
      clock.audioOffset = 1.5;
      clock.advance(TICK_MS);
      const late = beats.slice(1);
      expect(late.length).toBeGreaterThan(0);
      expect(late.every((b) => b.audioTime >= clock.currentTime)).toBe(true);
      expect(late[0]).toMatchObject({ beat: 4, countIn: true });
      clock.advance(1000);
      const bar0 = beats.find((b) => b.barIndex === 0 && b.beat === 1)!;
      // Count-in beat 4's slot is START_DELAY_S + 3 × 0.5 s; bar 0 is one beat later.
      expect(bar0.audioTime).toBeCloseTo(START_DELAY_S + 4 * 0.5, 9);
      expect(bar0.countIn).toBe(false);
    });

    it('stop during the count-in cancels its pending clicks', () => {
      runWithCountIn(settings(60, 96, 6, 4), 1);
      expect(beats.every((b) => b.countIn)).toBe(true);
      const future = clicks.filter((c) => c.time > clock.currentTime);
      scheduler.stop();
      clock.advance(5000);
      expect(future.every((c) => c.cancelled)).toBe(true);
      expect(beats.every((b) => b.countIn)).toBe(true);
    });

    it('restarts with a fresh count-in after a stop', () => {
      runWithCountIn(settings(60, 96, 6, 1), 10);
      scheduler.stop();
      beats = [];
      runWithCountIn(settings(60, 96, 6, 1), 0);
      expect(beats[0]).toMatchObject({ barIndex: -1, beat: 1, countIn: true });
    });
  });

  it('uses a ~25 ms tick', () => {
    expect(TICK_MS).toBe(25);
    expect(LOOKAHEAD_S).toBe(0.1);
  });
});
