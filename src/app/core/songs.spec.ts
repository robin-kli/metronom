import { Settings } from './settings';
import {
  applySong,
  parseSongs,
  removeSong,
  serializeSongs,
  Song,
  songKey,
  sortSongs,
  upsertSong,
  validateSong,
} from './songs';

const one: Song = { artist: 'Metallica', title: 'One', bpm: 140 };

describe('validateSong', () => {
  it('accepts and trims a valid draft', () => {
    expect(validateSong({ artist: ' Metallica ', title: ' One ', bpm: 140 })).toEqual(one);
  });

  it.each([
    ['empty artist', { artist: '', title: 'One', bpm: 140 }],
    ['blank artist', { artist: '   ', title: 'One', bpm: 140 }],
    ['empty song', { artist: 'Metallica', title: ' ', bpm: 140 }],
    ['BPM 0', { artist: 'Metallica', title: 'One', bpm: 0 }],
    ['BPM 12.5', { artist: 'Metallica', title: 'One', bpm: 12.5 }],
    ['BPM negative', { artist: 'Metallica', title: 'One', bpm: -5 }],
    ['BPM empty', { artist: 'Metallica', title: 'One', bpm: null }],
    ['BPM NaN', { artist: 'Metallica', title: 'One', bpm: Number.NaN }],
  ])('rejects %s', (_name, draft) => {
    expect(validateSong(draft)).toBeNull();
  });

  it('has no upper BPM limit', () => {
    expect(validateSong({ artist: 'a', title: 'b', bpm: 999 })?.bpm).toBe(999);
  });
});

describe('songKey / upsertSong / removeSong / sortSongs', () => {
  it('treats Artist + Song as trimmed and case-insensitive', () => {
    expect(songKey({ artist: ' metallica ', title: 'ONE' })).toBe(songKey(one));
    expect(songKey({ artist: 'Metallica', title: 'One2' })).not.toBe(songKey(one));
  });

  it('keeps the artist/title boundary in the key', () => {
    expect(songKey({ artist: 'ab', title: 'c' })).not.toBe(songKey({ artist: 'a', title: 'bc' }));
  });

  it('replaces a duplicate instead of adding one', () => {
    const songs = upsertSong(
      [one],
      validateSong({ artist: ' metallica ', title: 'ONE', bpm: 150 })!,
    );
    expect(songs).toHaveLength(1);
    expect(songs[0].bpm).toBe(150);
  });

  it('sorts by artist, then song, ignoring case', () => {
    const sorted = sortSongs([
      { artist: 'metallica', title: 'Sad but True', bpm: 90 },
      { artist: 'AC/DC', title: 'Thunderstruck', bpm: 134 },
      one,
    ]);
    expect(sorted.map((s) => s.title)).toEqual(['Thunderstruck', 'One', 'Sad but True']);
  });

  it('removes by key and leaves the input untouched', () => {
    const songs = [one, { artist: 'AC/DC', title: 'TNT', bpm: 130 }];
    expect(removeSong(songs, { artist: 'METALLICA', title: 'one' })).toEqual([songs[1]]);
    expect(songs).toHaveLength(2);
  });
});

describe('parseSongs', () => {
  it.each([
    ['null', null],
    ['empty string', ''],
    ['corrupt JSON', '{not json'],
    ['not an array', '{"artist":"a"}'],
    ['invalid entry', '[{"artist":1}]'],
    ['null entry', '[null]'],
  ])('loads %s as an empty list', (_name, raw) => {
    expect(parseSongs(raw)).toEqual([]);
  });

  it('keeps only the valid entries, trimmed and sorted', () => {
    const raw = JSON.stringify([
      { artist: 'Metallica', title: 'One', bpm: 140 },
      { artist: 1 },
      { artist: 'x', title: 'y', bpm: 0 },
      { artist: ' AC/DC ', title: 'TNT', bpm: 130, extra: true },
    ]);
    expect(parseSongs(raw)).toEqual([{ artist: 'AC/DC', title: 'TNT', bpm: 130 }, one]);
  });

  it('round-trips with serializeSongs', () => {
    expect(parseSongs(serializeSongs([one]))).toEqual([one]);
  });
});

describe('applySong', () => {
  const s = (startBpm: number | null, ceilingBpm: number | null): Settings => ({
    startBpm,
    ceilingBpm,
    step: 5,
    interval: 4,
  });

  it.each([
    ['sets the ceiling', s(60, 120), 140, s(60, 140)],
    ['lowers start when above the song', s(100, 120), 90, s(90, 90)],
    ['keeps start equal to the song', s(90, 120), 90, s(90, 90)],
    ['leaves an empty start alone', s(null, 120), 140, s(null, 140)],
  ])('%s', (_name, settings, bpm, expected) => {
    expect(applySong(settings, bpm)).toEqual(expected);
  });
});
