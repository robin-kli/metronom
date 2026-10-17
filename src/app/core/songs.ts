import { isPositiveWhole, Settings } from './settings';

/** A saved song: the tempo the user trains towards. */
export interface Song {
  artist: string;
  title: string;
  bpm: number;
  /** "My max": the highest tempo the user can play it at so far. Information only. */
  maxBpm: number | null;
}

/**
 * What the form holds; `bpm` and `maxBpm` are `null` while the field is empty or unparseable.
 * A missing `maxBpm` counts as empty.
 */
export interface SongDraft {
  artist: string;
  title: string;
  bpm: number | null;
  maxBpm?: number | null;
}

/** Returns the trimmed Song when the draft is valid, otherwise `null`. */
export function validateSong(draft: SongDraft): Song | null {
  const artist = typeof draft.artist === 'string' ? draft.artist.trim() : '';
  const title = typeof draft.title === 'string' ? draft.title.trim() : '';
  const maxBpm = draft.maxBpm ?? null;
  if (!artist || !title || !isPositiveWhole(draft.bpm)) {
    return null;
  }
  if (maxBpm !== null && !isPositiveWhole(maxBpm)) {
    return null;
  }
  return { artist, title, bpm: draft.bpm, maxBpm };
}

/** Identity of a song: Artist + Song, trimmed and case-insensitive. */
export function songKey(song: Pick<Song, 'artist' | 'title'>): string {
  return JSON.stringify([song.artist.trim().toLowerCase(), song.title.trim().toLowerCase()]);
}

/** Orders by Artist, then Song, ignoring case. */
export function sortSongs(songs: readonly Song[]): Song[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  return [...songs].sort((a, b) => cmp(a.artist, b.artist) || cmp(a.title, b.title));
}

/** Adds the song, or replaces the one with the same key. Returns a sorted copy. */
export function upsertSong(songs: readonly Song[], song: Song): Song[] {
  const key = songKey(song);
  return sortSongs([...songs.filter((s) => songKey(s) !== key), song]);
}

/** Removes the song with the same key. Returns a copy. */
export function removeSong(songs: readonly Song[], song: Pick<Song, 'artist' | 'title'>): Song[] {
  const key = songKey(song);
  return songs.filter((s) => songKey(s) !== key);
}

/**
 * Replaces `original` with `edited`: removes the original by key, then upserts the edited song,
 * so an edited Artist + Song that matches another entry replaces that entry too. Sorted copy.
 */
export function replaceSong(
  songs: readonly Song[],
  original: Pick<Song, 'artist' | 'title'>,
  edited: Song,
): Song[] {
  return upsertSong(removeSong(songs, original), edited);
}

/** Parses stored JSON. Keeps only valid entries (deduplicated, sorted); never throws. */
export function parseSongs(raw: string | null | undefined): Song[] {
  if (!raw) {
    return [];
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }
  let songs: Song[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const { artist, title, bpm, maxBpm } = entry as Record<string, unknown>;
    if (typeof artist !== 'string' || typeof title !== 'string' || typeof bpm !== 'number') {
      continue;
    }
    // Entries from before "My max" have none; an invalid one is dropped, the song is kept.
    const max = typeof maxBpm === 'number' && isPositiveWhole(maxBpm) ? maxBpm : null;
    const song = validateSong({ artist, title, bpm, maxBpm: max });
    if (song) {
      songs = upsertSong(songs, song);
    }
  }
  return songs;
}

/** Serialises songs for storage. */
export function serializeSongs(songs: readonly Song[]): string {
  return JSON.stringify(
    songs.map(({ artist, title, bpm, maxBpm }) => ({ artist, title, bpm, maxBpm })),
  );
}

/**
 * Settings after selecting a song: Ceiling becomes the song BPM, and Start is lowered to it
 * when it would otherwise be above it. Step and Interval are untouched.
 */
export function applySong(settings: Settings, bpm: number): Settings {
  const startBpm =
    typeof settings.startBpm === 'number' && settings.startBpm > bpm ? bpm : settings.startBpm;
  return { ...settings, startBpm, ceilingBpm: bpm };
}
