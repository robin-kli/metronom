import { Settings } from './settings';

/** Settings that passed `validate()`: every field is a whole number > 0 and ceiling ≥ start. */
export type ValidSettings = { readonly [K in keyof Settings]: number };

export interface RampState {
  /** Tempo of the Bar in BPM. */
  tempo: number;
  /** True once no further Increase fits under the Ceiling. */
  hold: boolean;
  /** Bars until the next Increase (counting this one); 0 in Hold. */
  barsToNext: number;
}

/** The only place tempo, hold and barsToNext are computed. */
export function rampAt(settings: ValidSettings, barIndex: number): RampState {
  const { startBpm, ceilingBpm, step, interval } = settings;
  const k = Math.floor(barIndex / interval);
  const kMax = Math.floor((ceilingBpm - startBpm) / step);
  const hold = k >= kMax;
  return {
    tempo: startBpm + Math.min(k, kMax) * step,
    hold,
    barsToNext: hold ? 0 : interval - (barIndex % interval),
  };
}
