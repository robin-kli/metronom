import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { TapTempoService } from '../../session/tap-tempo.service';

/** How long the Tap button shows its pressed fill after a tap (ms). */
const PRESSED_MS = 100;

/** The tap row: Tap button and readout. Taps by mouse press here, or by the T key (App). */
@Component({
  selector: 'app-tap-pad',
  templateUrl: './tap-pad.html',
  styleUrl: './tap-pad.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TapPad {
  protected readonly tap = inject(TapTempoService);
  protected readonly pressed = signal(false);

  private pressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Flash for every tap, mouse or key alike, but not for taps from before this pad was mounted.
    const mountedAt = untracked(() => this.tap.lastTap());
    effect(() => {
      if (this.tap.lastTap() === mountedAt) {
        return;
      }
      untracked(() => this.flash());
    });
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  protected onPointerDown(event: PointerEvent): void {
    // Primary button only; a right-click is not a tap.
    if (typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    this.tap.tap();
  }

  private flash(): void {
    this.clearTimer();
    this.pressed.set(true);
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      this.pressed.set(false);
    }, PRESSED_MS);
  }

  private clearTimer(): void {
    if (this.pressTimer !== null) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }
}
