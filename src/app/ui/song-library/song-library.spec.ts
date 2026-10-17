import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Song } from '../../core/songs';
import { SONG_STORAGE, SONG_STORAGE_KEY, SongStorage } from '../../session/song-library.service';
import { SongLibrary } from './song-library';

@Component({
  imports: [SongLibrary],
  template: `<app-song-library (songSelect)="picked.push($event)" />`,
})
class Host {
  picked: Song[] = [];
}

describe('SongLibrary', () => {
  let data: Map<string, string>;
  let failWrites: boolean;
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();
  const field = (name: string) => el.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  const save = () => el.querySelector('button.save') as HTMLButtonElement;
  const rows = () => Array.from(el.querySelectorAll('.row'));
  const hint = () => text(el.querySelector('.hint'));

  async function type(name: string, value: string) {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function fill(artist: string, title: string, bpm: string) {
    await type('artist', artist);
    await type('title', title);
    await type('bpm', bpm);
  }

  async function submit() {
    (el.querySelector('form') as HTMLFormElement).requestSubmit();
    await fixture.whenStable();
  }

  async function setup() {
    const storage: SongStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        if (failWrites) throw new Error('quota');
        data.set(k, v);
      },
    };
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: SONG_STORAGE, useValue: storage }],
    }).compileComponents();
    fixture = TestBed.createComponent(Host);
    el = fixture.nativeElement;
    await fixture.whenStable();
  }

  beforeEach(() => {
    data = new Map();
    failWrites = false;
  });

  it('shows the empty state, labelled fields and a disabled Save', async () => {
    await setup();
    expect(text(el.querySelector('.empty'))).toBe('No saved songs yet');
    expect(Array.from(el.querySelectorAll('.add .label')).map(text)).toEqual([
      'Artist',
      'Song',
      'BPM',
    ]);
    expect(field('artist').type).toBe('text');
    expect(field('title').type).toBe('text');
    expect(save().type).toBe('submit');
    expect(save().disabled).toBe(true);
    expect(el.querySelector('.hint')?.getAttribute('aria-live')).toBe('polite');
  });

  it('saves a song: row appears, storage holds it, form clears', async () => {
    await setup();
    await fill('Metallica', 'One', '140');
    expect(save().disabled).toBe(false);
    await submit();
    expect(rows().map((r) => text(r.querySelector('.pick')))).toEqual([
      'Metallica – One · 140 BPM',
    ]);
    expect(JSON.parse(data.get(SONG_STORAGE_KEY)!)).toEqual([
      { artist: 'Metallica', title: 'One', bpm: 140 },
    ]);
    expect([field('artist').value, field('title').value, field('bpm').value]).toEqual(['', '', '']);
    expect(save().disabled).toBe(true);
    expect(el.querySelector('.empty')).toBeNull();
  });

  it.each([
    ['empty artist', '', 'One', '140'],
    ['blank song', 'Metallica', '   ', '140'],
    ['BPM 0', 'Metallica', 'One', '0'],
    ['BPM 12.5', 'Metallica', 'One', '12.5'],
    ['empty BPM', 'Metallica', 'One', ''],
  ])('keeps Save disabled for %s and does not save on submit', async (_n, a, t, b) => {
    await setup();
    await fill(a, t, b);
    expect(save().disabled).toBe(true);
    await submit();
    expect(rows()).toHaveLength(0);
    expect(data.has(SONG_STORAGE_KEY)).toBe(false);
  });

  it('replaces a duplicate instead of adding a row', async () => {
    await setup();
    await fill('Metallica', 'One', '140');
    await submit();
    await fill(' metallica ', 'ONE', '150');
    await submit();
    expect(rows()).toHaveLength(1);
    expect(text(rows()[0].querySelector('.bpm'))).toBe('· 150 BPM');
  });

  it('lists stored songs sorted, emits songSelect on click and removes via the remove button', async () => {
    data.set(
      SONG_STORAGE_KEY,
      JSON.stringify([
        { artist: 'Metallica', title: 'One', bpm: 140 },
        { artist: 'AC/DC', title: 'TNT', bpm: 130 },
      ]),
    );
    await setup();
    expect(rows().map((r) => text(r.querySelector('.name')))).toEqual([
      'AC/DC – TNT',
      'Metallica – One',
    ]);
    (rows()[1].querySelector('.pick') as HTMLButtonElement).click();
    expect(fixture.componentInstance.picked).toEqual([
      { artist: 'Metallica', title: 'One', bpm: 140 },
    ]);
    const remove = rows()[1].querySelector('.remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Remove Metallica – One');
    remove.click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(1);
    expect(JSON.parse(data.get(SONG_STORAGE_KEY)!)).toEqual([
      { artist: 'AC/DC', title: 'TNT', bpm: 130 },
    ]);
  });

  it('shows the hint when a write fails but still lists the song', async () => {
    failWrites = true;
    await setup();
    expect(hint()).toBe('');
    await fill('Metallica', 'One', '140');
    await submit();
    expect(rows()).toHaveLength(1);
    expect(hint()).toBe('Songs could not be saved');
  });
});
