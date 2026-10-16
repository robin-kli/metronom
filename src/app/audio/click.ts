const ACCENT_HZ = 1600;
const BEAT_HZ = 1000;
/** Count-in: same envelope and gain, a different, mellower timbre (triangle, lower pitch). */
const COUNT_IN_ACCENT_HZ = 880;
const COUNT_IN_BEAT_HZ = 660;
const PEAK_GAIN = 0.6;
const ATTACK_S = 0.001;
const DURATION_S = 0.05;

/** A scheduled click that can be cut short. */
export interface ClickHandle {
  cancel(): void;
}

/**
 * Schedules one synthesised click at `time` (AudioContext seconds). Accent = higher pitch.
 * A count-in click has a different, mellower timbre (triangle, lower pitch); its accent is
 * still higher.
 */
export function scheduleClick(
  ctx: BaseAudioContext,
  time: number,
  accent: boolean,
  countIn = false,
): ClickHandle {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  if (countIn) {
    osc.type = 'triangle';
    osc.frequency.value = accent ? COUNT_IN_ACCENT_HZ : COUNT_IN_BEAT_HZ;
  } else {
    osc.type = 'square';
    osc.frequency.value = accent ? ACCENT_HZ : BEAT_HZ;
  }
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, time + ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + DURATION_S);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + DURATION_S);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
  return {
    cancel() {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      osc.disconnect();
      gain.disconnect();
    },
  };
}
