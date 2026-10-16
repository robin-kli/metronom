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
  /** Emitted when the user presses Stop. */
  readonly stop = output<void>();

  protected readonly summary = computed(() => {
    const { startBpm, ceilingBpm, step, interval } = this.settings();
    const bars = interval === 1 ? 'bar' : 'bars';
    return `${startBpm} → ${ceilingBpm} BPM · +${step} every ${interval} ${bars}`;
  });
}
