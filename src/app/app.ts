import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DEFAULT_SETTINGS, Settings } from './core/settings';
import { SettingsForm } from './ui/settings-form/settings-form';

@Component({
  selector: 'app-root',
  imports: [SettingsForm],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });

  protected onStart(): void {
    // Playback arrives in Story 1.2 (SessionService.start()).
  }
}
