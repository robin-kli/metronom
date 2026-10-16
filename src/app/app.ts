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
}
