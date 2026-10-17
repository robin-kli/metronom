import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { parseSongs, removeSong, serializeSongs, Song, upsertSong } from '../core/songs';

/** The part of `Storage` the song library uses; `null` when storage is unavailable. */
export type SongStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const SONG_STORAGE_KEY = 'metronom.songs.v1';
export const MSG_SONGS_NOT_SAVED = 'Songs could not be saved';

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

/** The saved songs. The only code that persists anything in the renderer. */
@Injectable({ providedIn: 'root' })
export class SongLibraryService {
  private readonly storage = inject(SONG_STORAGE);

  private readonly _songs = signal<Song[]>(this.load());
  private readonly _saveError = signal<string | null>(null);

  /** Saved songs, sorted by Artist, then Song. */
  readonly songs = this._songs.asReadonly();
  /** "Songs could not be saved" after a failed write, otherwise `null`. */
  readonly saveError = this._saveError.asReadonly();

  /** Adds the song, or replaces the BPM of the one with the same Artist + Song. */
  save(song: Song): void {
    this.commit(upsertSong(this._songs(), song));
  }

  remove(song: Song): void {
    this.commit(removeSong(this._songs(), song));
  }

  private load(): Song[] {
    try {
      return parseSongs(this.storage?.getItem(SONG_STORAGE_KEY));
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
      this.storage.setItem(SONG_STORAGE_KEY, serializeSongs(songs));
      this._saveError.set(null);
    } catch {
      this._saveError.set(MSG_SONGS_NOT_SAVED);
    }
  }
}
