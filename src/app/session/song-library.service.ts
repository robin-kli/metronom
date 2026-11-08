import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import {
  parseSongs,
  removeSong,
  replaceSong,
  serializeSongs,
  Song,
  upsertSong,
} from '../core/songs';

/** The part of `Storage` the song library uses; `null` when storage is unavailable. */
export type SongStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const SONG_STORAGE_KEY = 'metronom.songs.v1';
export const MSG_SONGS_NOT_SAVED = 'Songs could not be saved';
export const EXERCISE_STORAGE_KEY = 'metronom.exercises.v1';
export const MSG_EXERCISES_NOT_SAVED = 'Exercises could not be saved';

export const SONG_STORAGE = new InjectionToken<SongStorage | null>('SONG_STORAGE', {
  providedIn: 'root',
  factory: (): SongStorage | null => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      // Accessing localStorage can throw when storage is blocked.
      return null;
    }
  },
});

/**
 * The saved songs. Together with `ExerciseLibraryService` the only code that persists anything
 * in the renderer.
 */
@Injectable({ providedIn: 'root' })
export class SongLibraryService {
  private readonly storage = inject(SONG_STORAGE);

  /** Where this library is stored. A prototype getter so subclasses can override it before `load()` runs. */
  protected get storageKey(): string {
    return SONG_STORAGE_KEY;
  }

  /** Shown after a failed write. */
  protected get saveErrorMessage(): string {
    return MSG_SONGS_NOT_SAVED;
  }

  private readonly _songs = signal<Song[]>(this.load());
  private readonly _saveError = signal<string | null>(null);

  /** Saved songs, sorted by Artist, then Song. */
  readonly songs = this._songs.asReadonly();
  /** "Songs could not be saved" (or the subclass message) after a failed write, otherwise `null`. */
  readonly saveError = this._saveError.asReadonly();

  /** Adds the song, or replaces the BPM of the one with the same Artist + Song. */
  save(song: Song): void {
    this.commit(upsertSong(this._songs(), song));
  }

  /**
   * Replaces `original` with `edited` (Artist + Song may change). If the edited Artist + Song
   * matches another saved song, that entry is replaced too.
   */
  update(original: Song, edited: Song): void {
    this.commit(replaceSong(this._songs(), original, edited));
  }

  remove(song: Song): void {
    this.commit(removeSong(this._songs(), song));
  }

  private load(): Song[] {
    try {
      return parseSongs(this.storage?.getItem(this.storageKey));
    } catch {
      return [];
    }
  }

  private commit(songs: Song[]): void {
    this._songs.set(songs);
    try {
      if (!this.storage) {
        throw new Error('storage unavailable');
      }
      this.storage.setItem(this.storageKey, serializeSongs(songs));
      this._saveError.set(null);
    } catch {
      this._saveError.set(this.saveErrorMessage);
    }
  }
}

/**
 * The saved exercises: same entries and behaviour as songs (Source + Exercise + BPM + My max),
 * kept separately under its own storage key.
 */
@Injectable({ providedIn: 'root' })
export class ExerciseLibraryService extends SongLibraryService {
  protected override get storageKey(): string {
    return EXERCISE_STORAGE_KEY;
  }

  protected override get saveErrorMessage(): string {
    return MSG_EXERCISES_NOT_SAVED;
  }
}
