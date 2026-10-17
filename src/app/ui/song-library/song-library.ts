import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Song, songKey, validateSong } from '../../core/songs';
import { SongLibraryService } from '../../session/song-library.service';

@Component({
  selector: 'app-song-library',
  templateUrl: './song-library.html',
  styleUrl: './song-library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongLibrary {
  protected readonly library = inject(SongLibraryService);

  /** Emitted when the user picks a saved song. */
  readonly songSelect = output<Song>();

  protected readonly artist = signal('');
  protected readonly title = signal('');
  protected readonly bpm = signal<number | null>(null);

  protected readonly draft = computed(() =>
    validateSong({ artist: this.artist(), title: this.title(), bpm: this.bpm() }),
  );

  protected readonly key = songKey;

  protected onText(field: 'artist' | 'title', event: Event): void {
    this[field].set((event.target as HTMLInputElement).value);
  }

  protected onBpm(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.bpm.set(Number.isNaN(value) ? null : value);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const song = this.draft();
    if (!song) {
      return;
    }
    this.library.save(song);
    this.artist.set('');
    this.title.set('');
    this.bpm.set(null);
    (event.target as HTMLFormElement).reset();
  }
}
