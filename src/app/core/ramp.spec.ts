import { rampAt, RampState, ValidSettings } from './ramp';

const s = (
  startBpm: number,
  ceilingBpm: number,
  step: number,
  interval: number,
): ValidSettings => ({
  startBpm,
  ceilingBpm,
  step,
  interval,
});
const r = (tempo: number, hold: boolean, barsToNext: number): RampState => ({
  tempo,
  hold,
  barsToNext,
});

describe('rampAt', () => {
  const cases: [string, ValidSettings, number, RampState][] = [
    // Ramp 60 / 96 / +6 / 4
    ['ramp bar 0', s(60, 96, 6, 4), 0, r(60, false, 4)],
    ['ramp bar 1', s(60, 96, 6, 4), 1, r(60, false, 3)],
    ['ramp bar 2', s(60, 96, 6, 4), 2, r(60, false, 2)],
    ['ramp bar 3', s(60, 96, 6, 4), 3, r(60, false, 1)],
    ['ramp bar 4', s(60, 96, 6, 4), 4, r(66, false, 4)],
    ['ramp bar 23', s(60, 96, 6, 4), 23, r(90, false, 1)],
    ['ramp bar 24', s(60, 96, 6, 4), 24, r(96, true, 0)],
    ['ramp bar 100', s(60, 96, 6, 4), 100, r(96, true, 0)],
    // Overshoot 60 / 95 / +10 / 4
    ['overshoot bar 0', s(60, 95, 10, 4), 0, r(60, false, 4)],
    ['overshoot bar 4', s(60, 95, 10, 4), 4, r(70, false, 4)],
    ['overshoot bar 8', s(60, 95, 10, 4), 8, r(80, false, 4)],
    ['overshoot bar 11', s(60, 95, 10, 4), 11, r(80, false, 1)],
    ['overshoot bar 12', s(60, 95, 10, 4), 12, r(90, true, 0)],
    ['overshoot bar 40', s(60, 95, 10, 4), 40, r(90, true, 0)],
    // Equal
    ['equal bar 0', s(100, 100, 5, 4), 0, r(100, true, 0)],
    ['equal bar 9', s(100, 100, 5, 4), 9, r(100, true, 0)],
    // First step overshoots
    ['first step overshoots bar 0', s(60, 62, 5, 4), 0, r(60, true, 0)],
    ['first step overshoots bar 7', s(60, 62, 5, 4), 7, r(60, true, 0)],
    // Interval 1
    ['interval 1 bar 0', s(60, 70, 5, 1), 0, r(60, false, 1)],
    ['interval 1 bar 1', s(60, 70, 5, 1), 1, r(65, false, 1)],
    ['interval 1 bar 2', s(60, 70, 5, 1), 2, r(70, true, 0)],
    ['interval 1 bar 3', s(60, 70, 5, 1), 3, r(70, true, 0)],
  ];

  it.each(cases)('%s', (_name, settings, bar, expected) => {
    expect(rampAt(settings, bar)).toEqual(expected);
  });

  it('never exceeds the ceiling', () => {
    const settings = s(60, 95, 10, 2);
    for (let bar = 0; bar < 50; bar++) {
      expect(rampAt(settings, bar).tempo).toBeLessThanOrEqual(95);
    }
  });
});
