import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Song, songKey, validateSong } from '../../core/songs';
import { ExerciseLibraryService, SongLibraryService } from '../../session/song-library.service';

export type LibraryKind = 'songs' | 'exercises';

/** Visible wording per library; the entries themselves are identical. */
const TEXT: Record<LibraryKind, { heading: string; empty: string; source: string; name: string }> =
  {
    songs: { heading: 'Songs', empty: 'No saved songs yet', source: 'Artist', name: 'Song' },
    exercises: {
      heading: 'Exercises',
      empty: 'No saved exercises yet',
      source: 'Source',
      name: 'Exercise',
    },
  };

@Component({
  selector: 'app-song-library',
  templateUrl: './song-library.html',
  styleUrl: './song-library.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongLibrary {
  private readonly songs = inject(SongLibraryService);
  private readonly exercises = inject(ExerciseLibraryService);

  /** Which library this list shows and edits. */
  readonly kind = input<LibraryKind>('songs');

  protected readonly library = computed(() =>
    this.kind() === 'exercises' ? this.exercises : this.songs,
  );
  protected readonly text = computed(() => TEXT[this.kind()]);

  /** Emitted when the user picks a saved song (or exercise). */
  readonly songSelect = output<Song>();

  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('form');

  protected readonly artist = signal('');
  protected readonly title = signal('');
  protected readonly bpm = signal<number | null>(null);
  protected readonly maxBpm = signal<number | null>(null);
  /** The saved song being edited, or `null` when the form adds a new song. */
  protected readonly editing = signal<Song | null>(null);

  /** Whether "My max" holds something that is not a number (e.g. "1e"); keeps Save disabled. */
  private readonly maxInvalid = signal(false);

  protected readonly draft = computed(() =>
    this.maxInvalid()
      ? null
      : validateSong({
          artist: this.artist(),
          title: this.title(),
          bpm: this.bpm(),
          maxBpm: this.maxBpm(),
        }),
  );

  protected readonly key = songKey;

  protected isEditing(song: Song): boolean {
    const editing = this.editing();
    return editing !== null && songKey(editing) === songKey(song);
  }

  protected onText(field: 'artist' | 'title', event: Event): void {
    this[field].set((event.target as HTMLInputElement).value);
  }

  protected onNumber(field: 'bpm' | 'maxBpm', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.valueAsNumber;
    this[field].set(Number.isNaN(value) ? null : value);
    if (field === 'maxBpm') {
      // An empty max is allowed; unparseable input ("1e") is not.
      this.maxInvalid.set(input.validity.badInput);
    }
  }

  /** Loads the song into the form. Fields are written only here and when the form clears. */
  protected onEdit(song: Song): void {
    this.editing.set(song);
    this.artist.set(song.artist);
    this.title.set(song.title);
    this.bpm.set(song.bpm);
    this.maxBpm.set(song.maxBpm);
    this.maxInvalid.set(false);
    const form = this.form().nativeElement;
    this.setField(form, 'artist', song.artist);
    this.setField(form, 'title', song.title);
    this.setField(form, 'bpm', String(song.bpm));
    this.setField(form, 'maxBpm', song.maxBpm === null ? '' : String(song.maxBpm));
    this.focusArtist(form);
  }

  protected onRemove(song: Song): void {
    if (this.isEditing(song)) {
      this.clear();
    }
    this.library().remove(song);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const song = this.draft();
    if (!song) {
      return;
    }
    const editing = this.editing();
    if (editing) {
      this.library().update(editing, song);
    } else {
      this.library().save(song);
    }
    this.clear();
  }

  /** Empties the form and leaves edit mode. */
  protected clear(): void {
    const wasEditing = this.editing() !== null;
    this.editing.set(null);
    this.artist.set('');
    this.title.set('');
    this.bpm.set(null);
    this.maxBpm.set(null);
    this.maxInvalid.set(false);
    const form = this.form().nativeElement;
    form.reset();
    if (wasEditing) {
      // The Cancel/Update context disappears; keep focus in the form instead of on <body>.
      this.focusArtist(form);
    }
  }

  private focusArtist(form: HTMLFormElement): void {
    (form.elements.namedItem('artist') as HTMLInputElement).focus();
  }

  private setField(form: HTMLFormElement, name: string, value: string): void {
    (form.elements.namedItem(name) as HTMLInputElement).value = value;
  }
}
