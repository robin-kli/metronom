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

export type ValidationResult = { ok: true } | { ok: false; message: string };

export function isPositiveWhole(value: number | null): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** The only validity check for Settings. Reports the first problem only. */
export function validate(settings: Settings): ValidationResult {
  const { startBpm, ceilingBpm, step, interval } = settings;
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
