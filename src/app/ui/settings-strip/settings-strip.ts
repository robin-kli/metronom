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
  /** Emitted when the user presses Stop. */
  readonly stop = output<void>();

  protected readonly summary = computed(() => {
    const { startBpm, ceilingBpm, step, interval } = this.settings();
    const bars = interval === 1 ? 'bar' : 'bars';
    const summary = this.ramp()
      ? `${startBpm} → ${ceilingBpm} BPM · +${step} every ${interval} ${bars}`
      : `${startBpm} BPM · constant`;
    return this.countIn() ? `${summary} · count-in` : summary;
  });
}
