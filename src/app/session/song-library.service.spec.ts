import { TestBed } from '@angular/core/testing';
import { Song } from '../core/songs';
import {
  EXERCISE_STORAGE_KEY,
  ExerciseLibraryService,
  MSG_EXERCISES_NOT_SAVED,
  MSG_SONGS_NOT_SAVED,
  SONG_STORAGE,
  SONG_STORAGE_KEY,
  SongLibraryService,
  SongStorage,
} from './song-library.service';

class FakeStorage implements SongStorage {
  readonly data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

const one: Song = { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null };
const tnt: Song = { artist: 'AC/DC', title: 'TNT', bpm: 130, maxBpm: null };

describe('SongLibraryService', () => {
  let storage: FakeStorage;

  function create(store: SongStorage | null = storage): SongLibraryService {
    TestBed.configureTestingModule({ providers: [{ provide: SONG_STORAGE, useValue: store }] });
    return TestBed.inject(SongLibraryService);
  }

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('starts empty with nothing stored', () => {
    expect(create().songs()).toEqual([]);
  });

  it('loads the stored list on construction, sorted (restart)', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one, tnt]));
    expect(create().songs()).toEqual([tnt, one]);
  });

  it('loads corrupt storage as empty without throwing', () => {
    storage.data.set(SONG_STORAGE_KEY, '{not json');
    expect(create().songs()).toEqual([]);
  });

  it('loads as empty when reading throws', () => {
    const throwing: SongStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(create(throwing).songs()).toEqual([]);
  });

  it('persists a save, survives a new instance, and replaces duplicates', () => {
    const lib = create();
    lib.save(one);
    const dup: Song = { artist: 'metallica', title: 'ONE', bpm: 150, maxBpm: null };
    lib.save(dup);
    expect(lib.songs()).toEqual([dup]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([dup]);
    expect(lib.saveError()).toBeNull();
  });

  it('removes from the list and from storage', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one, tnt]));
    const lib = create();
    lib.remove(one);
    expect(lib.songs()).toEqual([tnt]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([tnt]);
  });

  it('persists an update, including a rename and the max', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one, tnt]));
    const lib = create();
    const edited: Song = { ...one, title: 'One (live)', bpm: 150, maxBpm: 110 };
    lib.update(one, edited);
    expect(lib.songs()).toEqual([tnt, edited]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([tnt, edited]);
    expect(lib.saveError()).toBeNull();
  });

  it('updates in memory and reports when an update write throws', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one]));
    const lib = create();
    storage.failWrites = true;
    lib.update(one, { ...one, bpm: 150 });
    expect(lib.songs()).toEqual([{ ...one, bpm: 150 }]);
    expect(lib.saveError()).toBe(MSG_SONGS_NOT_SAVED);
  });

  it('updates in memory and reports when a write throws, clearing on the next good write', () => {
    const lib = create();
    storage.failWrites = true;
    lib.save(one);
    expect(lib.songs()).toEqual([one]);
    expect(lib.saveError()).toBe(MSG_SONGS_NOT_SAVED);
    storage.failWrites = false;
    lib.save(tnt);
    expect(lib.saveError()).toBeNull();
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([tnt, one]);
  });

  it('updates in memory and reports when storage is unavailable', () => {
    const lib = create(null);
    lib.save(one);
    expect(lib.songs()).toEqual([one]);
    expect(lib.saveError()).toBe(MSG_SONGS_NOT_SAVED);
  });
});

describe('ExerciseLibraryService', () => {
  let storage: FakeStorage;
  const stickControl: Song = { artist: 'Stick Control', title: 'p.5', bpm: 100, maxBpm: null };

  function create(store: SongStorage | null = storage) {
    TestBed.configureTestingModule({ providers: [{ provide: SONG_STORAGE, useValue: store }] });
    return {
      exercises: TestBed.inject(ExerciseLibraryService),
      songs: TestBed.inject(SongLibraryService),
    };
  }

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('is a separate instance from the song library', () => {
    const { exercises, songs } = create();
    expect(exercises).not.toBe(songs);
  });

  it('saves under its own key only, leaving songs alone', () => {
    const { exercises, songs } = create();
    exercises.save(stickControl);
    expect(exercises.songs()).toEqual([stickControl]);
    expect(songs.songs()).toEqual([]);
    expect(JSON.parse(storage.data.get(EXERCISE_STORAGE_KEY)!)).toEqual([stickControl]);
    expect(storage.data.has(SONG_STORAGE_KEY)).toBe(false);
  });

  it('starts empty when only songs are stored, and songs stay unchanged', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one]));
    const { exercises, songs } = create();
    expect(exercises.songs()).toEqual([]);
    expect(songs.songs()).toEqual([one]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([one]);
  });

  it('loads stored exercises on construction', () => {
    storage.data.set(EXERCISE_STORAGE_KEY, JSON.stringify([stickControl]));
    expect(create().exercises.songs()).toEqual([stickControl]);
  });

  it('reports "Exercises could not be saved" on write failure', () => {
    const { exercises, songs } = create();
    storage.failWrites = true;
    exercises.save(stickControl);
    expect(exercises.songs()).toEqual([stickControl]);
    expect(exercises.saveError()).toBe(MSG_EXERCISES_NOT_SAVED);
    expect(MSG_EXERCISES_NOT_SAVED).toBe('Exercises could not be saved');
    expect(songs.saveError()).toBeNull();
  });
});
