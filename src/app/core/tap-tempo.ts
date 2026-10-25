import { isPositiveWhole, Settings } from './settings';

/** A pause longer than this (ms) ends a tap run; the next tap starts a new one. */
export const TAP_RESET_MS = 2500;

/** A tap closer than this (ms) to the previous one is a double hit and is ignored. */
export const TAP_MIN_GAP_MS = 100;

/** With at least this many intervals, outliers are dropped. */
const OUTLIER_MIN_INTERVALS = 4;
/** An interval more than this fraction off the median is an outlier. */
const OUTLIER_TOLERANCE = 0.3;
/** Dropping outliers must leave at least this many intervals, otherwise all are used. */
const MIN_KEPT_INTERVALS = 3;

/**
 * Tempo of a tap run from all its intervals (ms): 60000 / mean interval, rounded (halves up).
 * With ≥ 4 intervals, those more than 30% off the median are left out, unless fewer than 3
 * would remain. Returns null without intervals.
 */
export function tapBpm(intervals: readonly number[]): number | null {
  if (intervals.length === 0) {
    return null;
  }
  let used: readonly number[] = intervals;
  if (intervals.length >= OUTLIER_MIN_INTERVALS) {
    const med = median(intervals);
    const kept = intervals.filter((i) => Math.abs(i - med) <= med * OUTLIER_TOLERANCE);
    if (kept.length >= MIN_KEPT_INTERVALS) {
      used = kept;
    }
  }
  const mean = used.reduce((sum, i) => sum + i, 0) / used.length;
  if (!(mean > 0)) {
    return null;
  }
  return Math.floor(60000 / mean + 0.5);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Settings after a tap result: Start BPM (Tempo BPM) becomes `bpm`. In Ramp mode a valid Ceiling
 * below it is raised to it; a lower result never lowers the Ceiling. Step and Interval untouched.
 */
export function applyTap(settings: Settings, bpm: number, ramp: boolean): Settings {
  const ceilingBpm =
    ramp && isPositiveWhole(settings.ceilingBpm) && settings.ceilingBpm < bpm
      ? bpm
      : settings.ceilingBpm;
  return { ...settings, startBpm: bpm, ceilingBpm };
}
