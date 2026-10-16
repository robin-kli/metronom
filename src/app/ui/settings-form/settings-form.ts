import { ChangeDetectionStrategy, Component, computed, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Settings, validate } from '../../core/settings';

interface Field {
  key: keyof Settings;
  label: string;
}

@Component({
  selector: 'app-settings-form',
  imports: [FormsModule],
  templateUrl: './settings-form.html',
  styleUrl: './settings-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsForm {
  /** The four ramp Settings, two-way bound to the parent. */
  readonly settings = model.required<Settings>();
  /** Emitted when the user presses Start with valid Settings. */
  readonly start = output<void>();

  protected readonly fields: readonly Field[] = [
    { key: 'startBpm', label: 'Start BPM' },
    { key: 'ceilingBpm', label: 'Ceiling BPM' },
    { key: 'step', label: 'Step (BPM)' },
    { key: 'interval', label: 'Every (bars)' },
  ];

  protected readonly validation = computed(() => validate(this.settings()));
  protected readonly hint = computed(() => {
    const result = this.validation();
    return result.ok ? '' : result.message;
  });

  protected update(key: keyof Settings, value: number | string | null): void {
    // NumberValueAccessor yields a number, or null for an empty/unparseable field.
    const parsed = typeof value === 'number' && !Number.isNaN(value) ? value : null;
    this.settings.update((current) => ({ ...current, [key]: parsed }));
  }

  protected onStart(): void {
    if (this.validation().ok) {
      this.start.emit();
    }
  }
}
