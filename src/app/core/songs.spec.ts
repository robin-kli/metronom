import { Settings } from './settings';
import {
  applySong,
  parseSongs,
  removeSong,
  replaceSong,
  serializeSongs,
  Song,
  songKey,
  sortSongs,
  upsertSong,
  validateSong,
} from './songs';

const one: Song = { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null };
const tnt: Song = { artist: 'AC/DC', title: 'TNT', bpm: 130, maxBpm: null };

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

  it.each([
    ['missing', undefined, null],
    ['empty', null, null],
    ['below the BPM', 110, 110],
    ['above the BPM, no upper limit', 999, 999],
  ])('accepts a %s max', (_name, maxBpm, expected) => {
    expect(validateSong({ artist: 'a', title: 'b', bpm: 140, maxBpm })?.maxBpm).toBe(expected);
  });

  it.each([
    ['0', 0],
    ['12.5', 12.5],
    ['negative', -5],
    ['NaN', Number.NaN],
  ])('rejects a max of %s', (_name, maxBpm) => {
    expect(validateSong({ artist: 'a', title: 'b', bpm: 140, maxBpm })).toBeNull();
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
      { artist: 'metallica', title: 'Sad but True', bpm: 90, maxBpm: null },
      { artist: 'AC/DC', title: 'Thunderstruck', bpm: 134, maxBpm: null },
      one,
    ]);
    expect(sorted.map((s) => s.title)).toEqual(['Thunderstruck', 'One', 'Sad but True']);
  });

  it('removes by key and leaves the input untouched', () => {
    const songs = [one, tnt];
    expect(removeSong(songs, { artist: 'METALLICA', title: 'one' })).toEqual([songs[1]]);
    expect(songs).toHaveLength(2);
  });
});

describe('replaceSong', () => {
  it('updates the edited song in place', () => {
    const edited = { ...one, bpm: 150, maxBpm: 110 };
    expect(replaceSong([one, tnt], one, edited)).toEqual([tnt, edited]);
  });

  it('removes the old entry on rename', () => {
    const edited = { ...one, title: 'One (live)' };
    expect(replaceSong([one, tnt], one, edited)).toEqual([tnt, edited]);
  });

  it('replaces an existing entry when renamed onto it', () => {
    const battery: Song = { artist: 'Metallica', title: 'Battery', bpm: 190, maxBpm: 150 };
    const edited = { ...one, title: 'Battery', bpm: 160, maxBpm: null };
    expect(replaceSong([battery, one, tnt], one, edited)).toEqual([tnt, edited]);
  });

  it('leaves the input untouched', () => {
    const songs = [one, tnt];
    replaceSong(songs, one, { ...one, bpm: 150 });
    expect(songs).toEqual([one, tnt]);
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
    expect(parseSongs(raw)).toEqual([tnt, one]);
  });

  it('loads entries saved before "My max" with maxBpm null', () => {
    expect(parseSongs('[{"artist":"A","title":"B","bpm":90}]')).toEqual([
      { artist: 'A', title: 'B', bpm: 90, maxBpm: null },
    ]);
  });

  it.each([
    ['a string', '"fast"'],
    ['0', '0'],
    ['12.5', '12.5'],
    ['null', 'null'],
  ])('keeps the song and drops a stored max of %s', (_name, max) => {
    expect(parseSongs(`[{"artist":"A","title":"B","bpm":90,"maxBpm":${max}}]`)).toEqual([
      { artist: 'A', title: 'B', bpm: 90, maxBpm: null },
    ]);
  });

  it('round-trips with serializeSongs, including the max', () => {
    const songs = [{ ...tnt, maxBpm: 120 }, one];
    expect(parseSongs(serializeSongs(songs))).toEqual(songs);
    expect(JSON.parse(serializeSongs([one]))).toEqual([
      { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null },
    ]);
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

  it('in constant mode sets only Start, leaving the hidden Ceiling alone', () => {
    expect(applySong(s(60, 120), 140, false)).toEqual(s(140, 120));
    expect(applySong(s(100, 120), 90, false)).toEqual(s(90, 120));
  });
});
