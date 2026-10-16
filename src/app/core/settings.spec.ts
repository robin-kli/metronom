import {
  DEFAULT_SETTINGS,
  MSG_CEILING_BELOW_START,
  MSG_WHOLE_NUMBER,
  Settings,
  validate,
} from './settings';

const s = (
  startBpm: number | null,
  ceilingBpm: number | null,
  step: number | null,
  interval: number | null,
): Settings => ({ startBpm, ceilingBpm, step, interval });

describe('DEFAULT_SETTINGS', () => {
  it('is 60 / 120 / 5 / 4', () => {
    expect(DEFAULT_SETTINGS).toEqual(s(60, 120, 5, 4));
  });
});

describe('validate', () => {
  const cases: [string, Settings, string | null][] = [
    ['defaults', s(60, 120, 5, 4), null],
    ['equal ceiling', s(100, 100, 5, 4), null],
    ['ceiling below start', s(120, 100, 5, 4), MSG_CEILING_BELOW_START],
    ['empty start', s(null, 120, 5, 4), MSG_WHOLE_NUMBER],
    ['empty ceiling', s(60, null, 5, 4), MSG_WHOLE_NUMBER],
    ['empty step', s(60, 120, null, 4), MSG_WHOLE_NUMBER],
    ['empty interval', s(60, 120, 5, null), MSG_WHOLE_NUMBER],
    ['zero step', s(60, 120, 0, 4), MSG_WHOLE_NUMBER],
    ['negative interval', s(60, 120, 5, -1), MSG_WHOLE_NUMBER],
    ['zero start', s(0, 120, 5, 4), MSG_WHOLE_NUMBER],
    ['decimal start', s(60.5, 120, 5, 4), MSG_WHOLE_NUMBER],
    ['decimal interval', s(60, 120, 5, 2.5), MSG_WHOLE_NUMBER],
    ['NaN', s(Number.NaN, 120, 5, 4), MSG_WHOLE_NUMBER],
    ['Infinity', s(60, Number.POSITIVE_INFINITY, 5, 4), MSG_WHOLE_NUMBER],
    ['both problems: whole-number message first', s(0, -5, 5, 4), MSG_WHOLE_NUMBER],
  ];

  it.each(cases)('%s', (_name, settings, message) => {
    const result = validate(settings);
    if (message === null) {
      expect(result).toEqual({ ok: true });
    } else {
      expect(result).toEqual({ ok: false, message });
    }
  });
});
