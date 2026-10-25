import { rampAt } from './ramp';
import {
  applyRampOn,
  constantSettings,
  DEFAULT_SETTINGS,
  MSG_TEMPO_WHOLE,
  shiftTempo,
  MSG_CEILING_BELOW_START,
  MSG_WHOLE_NUMBER,
  Settings,
  shiftRange,
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

describe('shiftRange', () => {
  const cases: [string, Settings, number, Settings | 'same'][] = [
    ['up', s(60, 120, 5, 4), 1, s(61, 121, 5, 4)],
    ['down', s(60, 120, 5, 4), -1, s(59, 119, 5, 4)],
    ['down to the floor', s(2, 40, 5, 4), -1, s(1, 39, 5, 4)],
    ['down at the floor', s(1, 40, 5, 4), -1, 'same'],
    ['empty start', s(null, 120, 5, 4), 1, 'same'],
    ['empty ceiling', s(60, null, 5, 4), -1, 'same'],
    ['decimal start', s(60.5, 120, 5, 4), 1, 'same'],
    ['invalid step is carried along', s(60, 120, null, 4), 1, s(61, 121, null, 4)],
  ];

  it.each(cases)('%s', (_name, settings, delta, expected) => {
    const result = shiftRange(settings, delta);
    if (expected === 'same') {
      expect(result).toBe(settings);
    } else {
      expect(result).toEqual(expected);
    }
  });
});

describe('validate in constant mode (ramp off)', () => {
  it.each<[string, Settings, string | null]>([
    ['start only, ceiling empty', s(90, null, null, null), null],
    ['ceiling below start is fine', s(150, 120, 5, 4), null],
    ['empty start', s(null, 120, 5, 4), MSG_TEMPO_WHOLE],
    ['zero start', s(0, 120, 5, 4), MSG_TEMPO_WHOLE],
    ['decimal start', s(60.5, 120, 5, 4), MSG_TEMPO_WHOLE],
  ])('%s', (_name, settings, message) => {
    const result = validate(settings, false);
    expect(result).toEqual(message === null ? { ok: true } : { ok: false, message });
  });

  it('defaults to ramp mode', () => {
    expect(validate(s(60, null, 5, 4))).toEqual({ ok: false, message: MSG_WHOLE_NUMBER });
  });
});

describe('shiftTempo', () => {
  it('shifts Start only', () => {
    expect(shiftTempo(s(60, 120, 5, 4), 1)).toEqual(s(61, 120, 5, 4));
    expect(shiftTempo(s(60, 120, 5, 4), -1)).toEqual(s(59, 120, 5, 4));
  });

  it('stops at 1 and ignores an empty Start', () => {
    const one = s(1, 120, 5, 4);
    expect(shiftTempo(one, -1)).toBe(one);
    const empty = s(null, 120, 5, 4);
    expect(shiftTempo(empty, 1)).toBe(empty);
  });

  it('works with a hidden empty Ceiling', () => {
    expect(shiftTempo(s(60, null, null, null), 1)).toEqual(s(61, null, null, null));
  });
});

describe('applyRampOn', () => {
  it('raises a Ceiling below Start to Start', () => {
    expect(applyRampOn(s(150, 120, 5, 4))).toEqual(s(150, 150, 5, 4));
  });

  it.each<[string, Settings]>([
    ['ceiling above start', s(60, 120, 5, 4)],
    ['empty ceiling', s(150, null, 5, 4)],
    ['empty start', s(null, 120, 5, 4)],
  ])('leaves %s alone', (_name, settings) => {
    expect(applyRampOn(settings)).toBe(settings);
  });
});

describe('constantSettings', () => {
  it('sets Ceiling to Start so every bar plays at Start', () => {
    const constant = constantSettings(s(90, 120, 5, 4));
    expect(constant).toEqual({ startBpm: 90, ceilingBpm: 90, step: 5, interval: 4 });
    for (const bar of [0, 1, 4, 100]) {
      expect(rampAt(constant, bar)).toEqual({ tempo: 90, hold: true, barsToNext: 0 });
    }
  });

  it('fills hidden empty fields so the ramp maths stays finite', () => {
    const constant = constantSettings(s(90, null, null, 0));
    expect(constant).toEqual({ startBpm: 90, ceilingBpm: 90, step: 1, interval: 1 });
    expect(rampAt(constant, 7).tempo).toBe(90);
  });
});
