import type { ValidSettings } from './ramp';

/** The four ramp Settings. A field is `null` while its input is empty or unparseable. */
export interface Settings {
  startBpm: number | null;
  ceilingBpm: number | null;
  step: number | null;
  interval: number | null;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  startBpm: 60,
  ceilingBpm: 120,
  step: 5,
  interval: 4,
};

export const MSG_WHOLE_NUMBER = 'All fields need a whole number above 0';
export const MSG_CEILING_BELOW_START = 'Ceiling must be at least the start BPM';
export const MSG_TEMPO_WHOLE = 'Tempo needs a whole number above 0';

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function isPositiveWhole(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * The only validity check for Settings. Reports the first problem only.
 * With `ramp` off (constant mode) only Start BPM, shown as "Tempo BPM", is checked.
 */
export function validate(settings: Settings, ramp = true): ValidationResult {
  const { startBpm, ceilingBpm, step, interval } = settings;
  if (!ramp) {
    return isPositiveWhole(startBpm) ? { ok: true } : { ok: false, message: MSG_TEMPO_WHOLE };
  }
  if (
    !isPositiveWhole(startBpm) ||
    !isPositiveWhole(ceilingBpm) ||
    !isPositiveWhole(step) ||
    !isPositiveWhole(interval)
  ) {
    return { ok: false, message: MSG_WHOLE_NUMBER };
  }
  if (ceilingBpm < startBpm) {
    return { ok: false, message: MSG_CEILING_BELOW_START };
  }
  return { ok: true };
}

/**
 * Moves the ramp: Start and Ceiling BPM shift together by `delta`, keeping their gap.
 * Returns `settings` unchanged when either is not a positive whole number or Start would drop below 1.
 */
export function shiftRange(settings: Settings, delta: number): Settings {
  const { startBpm, ceilingBpm } = settings;
  if (!isPositiveWhole(startBpm) || !isPositiveWhole(ceilingBpm) || startBpm + delta < 1) {
    return settings;
  }
  return { ...settings, startBpm: startBpm + delta, ceilingBpm: ceilingBpm + delta };
}

/**
 * Constant mode: shifts Start BPM alone by `delta`.
 * Returns `settings` unchanged when Start is not a positive whole number or would drop below 1.
 */
export function shiftTempo(settings: Settings, delta: number): Settings {
  const { startBpm } = settings;
  if (!isPositiveWhole(startBpm) || startBpm + delta < 1) {
    return settings;
  }
  return { ...settings, startBpm: startBpm + delta };
}

/**
 * Switching Ramp back on: a valid Ceiling that is below a valid Start is raised to Start,
 * so Start is never blocked by a field that was hidden. Everything else is kept.
 */
export function applyRampOn(settings: Settings): Settings {
  const { startBpm, ceilingBpm } = settings;
  if (isPositiveWhole(startBpm) && isPositiveWhole(ceilingBpm) && ceilingBpm < startBpm) {
    return { ...settings, ceilingBpm: startBpm };
  }
  return settings;
}

/**
 * The Settings a constant-mode Session plays: Ceiling = Start, so `rampAt` holds from bar 0.
 * Expects Settings that passed `validate(settings, false)`. Hidden Step / Every may be empty,
 * so they fall back to 1 to keep the ramp maths finite (they have no effect with no gap).
 */
export function constantSettings(settings: Settings): ValidSettings {
  const startBpm = settings.startBpm as number;
  return {
    startBpm,
    ceilingBpm: startBpm,
    step: isPositiveWhole(settings.step) ? settings.step : 1,
    interval: isPositiveWhole(settings.interval) ? settings.interval : 1,
  };
}
