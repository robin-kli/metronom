import { Settings } from './settings';
import { applyTap, TAP_RESET_MS, tapBpm } from './tap-tempo';

const s = (startBpm: number | null, ceilingBpm: number | null): Settings => ({
  startBpm,
  ceilingBpm,
  step: 5,
  interval: 4,
});

describe('tapBpm', () => {
  it.each<[string, number[], number | null]>([
    ['no intervals', [], null],
    ['one interval', [500], 120],
    ['mean of all (taps at 0, 500, 1000, 1500)', [500, 500, 500], 120],
    ['mean, not last interval', [600, 400], 120],
    ['drops a strong outlier', [500, 500, 500, 500, 900], 120],
    ['drops a short double hit', [500, 500, 250, 500, 500], 120],
    ['uses all when fewer than 3 would remain', [500, 1000, 1000, 500], 80],
    ['keeps outliers below 4 intervals', [500, 500, 900], 95],
    ['keeps an interval exactly 30% off', [1000, 1000, 1000, 1300], 56],
    ['rounds halves up', [480], 125],
    ['rounds to nearest', [700], 86],
    ['zero intervals', [0, 0], null],
  ])('%s', (_name, intervals, expected) => {
    expect(tapBpm(intervals)).toBe(expected);
  });

  it('resets after 2.5 s', () => {
    expect(TAP_RESET_MS).toBe(2500);
  });
});

describe('applyTap', () => {
  it('writes Start and raises a lower Ceiling in Ramp mode', () => {
    expect(applyTap(s(60, 120), 150, true)).toEqual(s(150, 150));
  });

  it('never lowers the Ceiling', () => {
    expect(applyTap(s(150, 150), 100, true)).toEqual(s(100, 150));
  });

  it('leaves the hidden Ceiling alone in constant mode', () => {
    expect(applyTap(s(60, 120), 150, false)).toEqual(s(150, 120));
  });

  it('leaves an empty Ceiling empty', () => {
    expect(applyTap(s(60, null), 150, true)).toEqual(s(150, null));
  });
});
