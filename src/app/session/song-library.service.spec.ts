import { TestBed } from '@angular/core/testing';
import { Song } from '../core/songs';
import {
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

const one: Song = { artist: 'Metallica', title: 'One', bpm: 140 };
const tnt: Song = { artist: 'AC/DC', title: 'TNT', bpm: 130 };

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
    lib.save({ artist: 'metallica', title: 'ONE', bpm: 150 });
    expect(lib.songs()).toEqual([{ artist: 'metallica', title: 'ONE', bpm: 150 }]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([
      { artist: 'metallica', title: 'ONE', bpm: 150 },
    ]);
    expect(lib.saveError()).toBeNull();
  });

  it('removes from the list and from storage', () => {
    storage.data.set(SONG_STORAGE_KEY, JSON.stringify([one, tnt]));
    const lib = create();
    lib.remove(one);
    expect(lib.songs()).toEqual([tnt]);
    expect(JSON.parse(storage.data.get(SONG_STORAGE_KEY)!)).toEqual([tnt]);
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
