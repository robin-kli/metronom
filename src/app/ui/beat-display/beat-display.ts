import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BeatEvent } from '../../core/beat-event';

/** Render-only view of the published BeatEvent: BPM, four beat blocks and the status line. */
@Component({
  selector: 'app-beat-display',
  templateUrl: './beat-display.html',
  styleUrl: './beat-display.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeatDisplay {
  /** The latest sounded Beat, or null before the first one. */
  readonly event = input.required<BeatEvent | null>();
  /** Start BPM shown before the first Beat. */
  readonly startBpm = input.required<number>();
  readonly step = input.required<number>();

  protected readonly beats = [1, 2, 3, 4] as const;

  protected readonly litBeat = computed(() => this.event()?.beat ?? 0);

  protected readonly bpm = computed(() => this.event()?.tempo ?? this.startBpm());

  protected readonly status = computed(() => {
    const event = this.event();
    if (!event) {
      return '';
    }
    if (event.countIn) {
      return 'Count-in';
    }
    if (event.hold) {
      return `Holding at ${event.tempo} BPM`;
    }
    const bars = event.barsToNext === 1 ? 'bar' : 'bars';
    return `${event.barsToNext} ${bars} to +${this.step()}`;
  });

  /** Changes only when the tempo or count-in state does, so each is announced once. */
  protected readonly announcement = computed(() => {
    const event = this.event();
    if (!event) {
      return '';
    }
    return event.countIn ? `Count-in, ${event.tempo} BPM` : `${event.tempo} BPM`;
  });
}
