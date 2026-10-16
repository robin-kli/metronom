import { scheduleClick } from './click';

class FakeParam {
  value = 0;
  calls: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.calls.push(['set', v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.calls.push(['linear', v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(['exp', v, t]);
  }
}

class FakeNode {
  connections: unknown[] = [];
  connect<T>(target: T): T {
    this.connections.push(target);
    return target;
  }
  disconnect() {
    this.connections = [];
  }
}

class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  start(t: number) {
    this.starts.push(t);
  }
  stop(t?: number) {
    this.stops.push(t);
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeContext {
  destination = { name: 'destination' };
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  createOscillator() {
    const o = new FakeOscillator();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
}

describe('scheduleClick', () => {
  const schedule = (ctx: FakeContext, time: number, accent: boolean) =>
    scheduleClick(ctx as unknown as BaseAudioContext, time, accent);

  it('plays the accent at a higher pitch than a normal beat', () => {
    const ctx = new FakeContext();
    schedule(ctx, 1, true);
    schedule(ctx, 2, false);
    expect(ctx.oscillators[0].frequency.value).toBeGreaterThan(ctx.oscillators[1].frequency.value);
  });

  it('starts at time, stops shortly after and routes through a gain to the destination', () => {
    const ctx = new FakeContext();
    schedule(ctx, 3, false);
    const osc = ctx.oscillators[0];
    const gain = ctx.gains[0];
    expect(osc.starts).toEqual([3]);
    expect(osc.stops.length).toBe(1);
    expect(osc.stops[0]!).toBeGreaterThan(3);
    expect(osc.stops[0]!).toBeLessThan(3.2);
    expect(osc.connections).toEqual([gain]);
    expect(gain.connections).toEqual([ctx.destination]);
    expect(gain.gain.calls[0]).toEqual(['set', 0, 3]);
  });

  it('cancel() stops the oscillator and disconnects it', () => {
    const ctx = new FakeContext();
    const handle = schedule(ctx, 5, true);
    handle.cancel();
    const osc = ctx.oscillators[0];
    expect(osc.stops.length).toBe(2);
    expect(osc.stops[1]).toBeUndefined();
    expect(osc.connections).toEqual([]);
    expect(ctx.gains[0].connections).toEqual([]);
  });
});
