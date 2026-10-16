const ACCENT_HZ = 1600;
const BEAT_HZ = 1000;
const PEAK_GAIN = 0.6;
const ATTACK_S = 0.001;
const DURATION_S = 0.05;

/** A scheduled click that can be cut short. */
export interface ClickHandle {
  cancel(): void;
}

/** Schedules one synthesised click at `time` (AudioContext seconds). Accent = higher pitch. */
export function scheduleClick(ctx: BaseAudioContext, time: number, accent: boolean): ClickHandle {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? ACCENT_HZ : BEAT_HZ;
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
