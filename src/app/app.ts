import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Settings } from './core/settings';
import { SessionService } from './session/session.service';
import { BeatDisplay } from './ui/beat-display/beat-display';
import { SettingsForm } from './ui/settings-form/settings-form';
import { SettingsStrip } from './ui/settings-strip/settings-strip';

@Component({
  selector: 'app-root',
  imports: [BeatDisplay, SettingsForm, SettingsStrip],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:keydown)': 'onKeydown($event)' },
})
export class App {
  protected readonly session = inject(SessionService);

  protected onSettingsChange(settings: Settings): void {
    this.session.updateSettings(settings);
  }

  protected onStart(): void {
    void this.session.start();
  }

  protected onStop(): void {
    this.session.stop();
  }

  /** The only keyboard handler: Space toggles, Enter in a settings field starts, Escape stops. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const playing = this.session.status() === 'playing';
    switch (event.key) {
      case ' ':
        // Always swallow Space: no typed space, no scroll, no native button activation.
        event.preventDefault();
        if (event.repeat) {
          return;
        }
        if (playing) {
          this.session.stop();
        } else {
          void this.session.start();
        }
        return;
      case 'Enter':
        if (event.repeat || event.isComposing || playing) {
          return;
        }
        if (event.target instanceof HTMLInputElement && event.target.closest('app-settings-form')) {
          void this.session.start();
        }
        return;
      case 'Escape':
        if (!event.repeat && playing) {
          this.session.stop();
        }
        return;
    }
  }
}
