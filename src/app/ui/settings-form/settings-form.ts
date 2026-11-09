import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DEFAULT_AUDIBLE_PERCENT,
  isAudiblePercent,
  MSG_AUDIBLE_PERCENT,
  Settings,
  validate,
  ValidationResult,
} from '../../core/settings';
import { TapPad } from '../tap-pad/tap-pad';

interface Field {
  key: keyof Settings;
  label: string;
}

@Component({
  selector: 'app-settings-form',
  imports: [FormsModule, TapPad],
  templateUrl: './settings-form.html',
  styleUrl: './settings-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsForm {
  /** The four ramp Settings, two-way bound to the parent. */
  readonly settings = model.required<Settings>();
  /** Whether the Session starts with a count-in, two-way bound to the parent. */
  readonly countIn = model.required<boolean>();
  /** Ramp on (four fields) or off (constant mode: Tempo BPM only), two-way bound to the parent. */
  readonly ramp = model(true);
  /** Random click dropout on/off, two-way bound to the parent. */
  readonly random = model(false);
  /** Audible % (0..100) with Random on, `null` while empty/unparseable; two-way bound to the parent. */
  readonly randomPercent = model<number | null>(DEFAULT_AUDIBLE_PERCENT);
  /** Emitted when the user presses Start with valid Settings. */
  readonly start = output<void>();
  /** A message from outside the form (e.g. audio failure), shown when Settings are valid. */
  readonly extraHint = input<string | null>(null);

  private readonly rampFields: readonly Field[] = [
    { key: 'startBpm', label: 'Start BPM' },
    { key: 'ceilingBpm', label: 'Ceiling BPM' },
    { key: 'step', label: 'Step (BPM)' },
    { key: 'interval', label: 'Every (bars)' },
  ];
  private readonly constantFields: readonly Field[] = [{ key: 'startBpm', label: 'Tempo BPM' }];

  /** With Ramp off only Start BPM is shown, as "Tempo BPM"; the hidden values are kept. */
  protected readonly fields = computed(() => (this.ramp() ? this.rampFields : this.constantFields));

  /** Settings first; then, with Random on, the Audible % (hidden and ignored with Random off). */
  protected readonly validation = computed((): ValidationResult => {
    const result = validate(this.settings(), this.ramp());
    if (result.ok && this.random() && !isAudiblePercent(this.randomPercent())) {
      return { ok: false, message: MSG_AUDIBLE_PERCENT };
    }
    return result;
  });
  protected readonly hint = computed(() => {
    const result = this.validation();
    return result.ok ? (this.extraHint() ?? '') : result.message;
  });

  protected update(key: keyof Settings, value: number | string | null): void {
    // NumberValueAccessor yields a number, or null for an empty/unparseable field.
    const parsed = typeof value === 'number' && !Number.isNaN(value) ? value : null;
    this.settings.update((current) => ({ ...current, [key]: parsed }));
  }

  /** Stepper: changes one field by `delta`. An empty (or below 1) field steps up to 1; nothing goes below 1. */
  protected nudge(key: keyof Settings, delta: number): void {
    const value = this.settings()[key];
    const next = value === null || value < 1 ? (delta > 0 ? 1 : null) : value + delta;
    if (next === null || next < 1) {
      return;
    }
    this.settings.update((current) => ({ ...current, [key]: next }));
  }

  protected canDecrease(key: keyof Settings): boolean {
    const value = this.settings()[key];
    return value !== null && value - 1 >= 1;
  }

  protected toggleRamp(): void {
    this.ramp.update((on) => !on);
  }

  protected updatePercent(value: number | string | null): void {
    this.randomPercent.set(typeof value === 'number' && !Number.isNaN(value) ? value : null);
  }

  /** Audible % stepper: ±5 from the rounded value, clamped to 0..100. An empty field steps up from 0. */
  protected nudgePercent(delta: number): void {
    const value = Math.round(this.randomPercent() ?? 0);
    this.randomPercent.set(Math.min(100, Math.max(0, value + delta)));
  }

  protected canDecreasePercent(): boolean {
    const value = this.randomPercent();
    return value !== null && value > 0;
  }

  protected canIncreasePercent(): boolean {
    const value = this.randomPercent();
    return value === null || value < 100;
  }

  protected toggleRandom(): void {
    this.random.update((on) => !on);
  }

  protected toggleCountIn(): void {
    this.countIn.update((on) => !on);
  }

  protected onStart(): void {
    if (this.validation().ok) {
      this.start.emit();
    }
  }
}
