import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Settings } from '../../core/settings';

@Component({
  selector: 'app-settings-strip',
  templateUrl: './settings-strip.html',
  styleUrl: './settings-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsStrip {
  /** The locked Settings of the running Session. */
  readonly settings = input.required<Settings>();
  /** Whether the running Session started with a count-in. */
  readonly countIn = input(false);
  /** Whether the running Session ramps; off means constant mode. */
  readonly ramp = input(true);
  /** Whether the running Session drops clicks at random. */
  readonly random = input(false);
  /** The Audible % of the running Session (shown only with Random on). */
  readonly randomPercent = input<number | null>(null);
  /** Emitted when the user presses Stop. */
  readonly stop = output<void>();

  protected readonly summary = computed(() => {
    const { startBpm, ceilingBpm, step, interval } = this.settings();
    const bars = interval === 1 ? 'bar' : 'bars';
    const summary = this.ramp()
      ? `${startBpm} → ${ceilingBpm} BPM · +${step} every ${interval} ${bars}`
      : `${startBpm} BPM · constant`;
    const withCountIn = this.countIn() ? `${summary} · count-in` : summary;
    return this.random() ? `${withCountIn} · random ${this.randomPercent()}%` : withCountIn;
  });
}
