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

  async function fill(artist: string, title: string, bpm: string, maxBpm = '') {
    await type('artist', artist);
    await type('title', title);
    await type('bpm', bpm);
    await type('maxBpm', maxBpm);
  }

  const values = () => ['artist', 'title', 'bpm', 'maxBpm'].map((n) => field(n).value);
  const cancel = () => el.querySelector('button.cancel') as HTMLButtonElement | null;
  const rowTexts = () => rows().map((r) => text(r.querySelector('.pick')));
  const stored = () => JSON.parse(data.get(SONG_STORAGE_KEY)!);
  const button = (label: string) =>
    el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

  async function click(b: HTMLButtonElement | null) {
    b!.click();
    await fixture.whenStable();
  }

  function seed(songs: object[]) {
    data.set(SONG_STORAGE_KEY, JSON.stringify(songs));
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
      'My max (BPM)',
    ]);
    expect(field('maxBpm').type).toBe('number');
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
    expect(stored()).toEqual([{ artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null }]);
    expect(values()).toEqual(['', '', '', '']);
    expect(save().disabled).toBe(true);
    expect(el.querySelector('.empty')).toBeNull();
  });

  it.each([
    ['empty artist', '', 'One', '140'],
    ['blank song', 'Metallica', '   ', '140'],
    ['BPM 0', 'Metallica', 'One', '0'],
    ['BPM 12.5', 'Metallica', 'One', '12.5'],
    ['empty BPM', 'Metallica', 'One', ''],
    ['max 0', 'Metallica', 'One', '140', '0'],
    ['max 12.5', 'Metallica', 'One', '140', '12.5'],
  ])('keeps Save disabled for %s and does not save on submit', async (_n, a, t, b, m = '') => {
    await setup();
    await fill(a, t, b, m);
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
        { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null },
        { artist: 'AC/DC', title: 'TNT', bpm: 130, maxBpm: null },
      ]),
    );
    await setup();
    expect(rows().map((r) => text(r.querySelector('.name')))).toEqual([
      'AC/DC – TNT',
      'Metallica – One',
    ]);
    (rows()[1].querySelector('.pick') as HTMLButtonElement).click();
    expect(fixture.componentInstance.picked).toEqual([
      { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: null },
    ]);
    const remove = rows()[1].querySelector('.remove') as HTMLButtonElement;
    expect(remove.getAttribute('aria-label')).toBe('Remove Metallica – One');
    remove.click();
    await fixture.whenStable();
    expect(rows()).toHaveLength(1);
    expect(stored()).toEqual([{ artist: 'AC/DC', title: 'TNT', bpm: 130, maxBpm: null }]);
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

  it('saves a song with a max and shows it in the row', async () => {
    await setup();
    await fill('Metallica', 'One', '140', '110');
    await submit();
    expect(rowTexts()).toEqual(['Metallica – One · 140 BPM · max 110']);
    expect(stored()).toEqual([{ artist: 'Metallica', title: 'One', bpm: 140, maxBpm: 110 }]);
  });

  it('keeps Save disabled while the max is unparseable (badInput)', async () => {
    await setup();
    await fill('Metallica', 'One', '140');
    expect(save().disabled).toBe(false);
    const max = field('maxBpm');
    Object.defineProperty(max, 'validity', { configurable: true, value: { badInput: true } });
    max.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(save().disabled).toBe(true);
    await submit();
    expect(rows()).toHaveLength(0);
    expect(data.has(SONG_STORAGE_KEY)).toBe(false);
    delete (max as unknown as Record<string, unknown>)['validity'];
    await type('maxBpm', '');
    expect(save().disabled).toBe(false);
  });

  it('accepts a max above the song BPM', async () => {
    await setup();
    await fill('Metallica', 'One', '140', '200');
    expect(save().disabled).toBe(false);
  });

  describe('edit mode', () => {
    const one = { artist: 'Metallica', title: 'One', bpm: 140, maxBpm: 110 };
    const battery = { artist: 'Metallica', title: 'Battery', bpm: 190, maxBpm: null };

    it('loads the song into the form with Update and Cancel', async () => {
      seed([one]);
      await setup();
      expect(cancel()).toBeNull();
      const edit = button('Edit Metallica – One');
      expect(text(edit)).toBe('✎');
      await click(edit);
      expect(values()).toEqual(['Metallica', 'One', '140', '110']);
      expect(text(save())).toBe('Update');
      expect(save().disabled).toBe(false);
      expect(cancel()).not.toBeNull();
      expect(document.activeElement).toBe(field('artist'));
      expect(button('Edit Metallica – One').title).toBe('Edit');
      expect(button('Remove Metallica – One').title).toBe('Remove');
    });

    it('keeps focus in the form after Cancel and after Update', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      cancel()!.focus();
      await click(cancel());
      expect(document.activeElement).toBe(field('artist'));
      await click(button('Edit Metallica – One'));
      save().focus();
      await submit();
      expect(document.activeElement).toBe(field('artist'));
    });

    it('edits a song saved before "My max" existed', async () => {
      data.set(SONG_STORAGE_KEY, '[{"artist":"A","title":"B","bpm":90}]');
      await setup();
      await click(button('Edit A – B'));
      expect(values()).toEqual(['A', 'B', '90', '']);
      await type('maxBpm', '80');
      await submit();
      expect(stored()).toEqual([{ artist: 'A', title: 'B', bpm: 90, maxBpm: 80 }]);
    });

    it('fills an empty max for a song without one', async () => {
      seed([battery]);
      await setup();
      await click(button('Edit Metallica – Battery'));
      expect(values()).toEqual(['Metallica', 'Battery', '190', '']);
    });

    it('updates the BPM in place and leaves edit mode', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      await type('bpm', '150');
      await submit();
      expect(rowTexts()).toEqual(['Metallica – One · 150 BPM · max 110']);
      expect(stored()).toEqual([{ ...one, bpm: 150 }]);
      expect(values()).toEqual(['', '', '', '']);
      expect(text(save())).toBe('Save');
      expect(cancel()).toBeNull();
    });

    it('clears the max', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      await type('maxBpm', '');
      await submit();
      expect(stored()).toEqual([{ ...one, maxBpm: null }]);
    });

    it('renames: the old row is gone, the new row is present', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      await type('title', 'One (live)');
      await submit();
      expect(rowTexts()).toEqual(['Metallica – One (live) · 140 BPM · max 110']);
    });

    it('renaming onto an existing song replaces it', async () => {
      seed([one, battery]);
      await setup();
      await click(button('Edit Metallica – One'));
      await type('title', 'Battery');
      await submit();
      expect(rowTexts()).toEqual(['Metallica – Battery · 140 BPM · max 110']);
      expect(stored()).toEqual([{ ...one, title: 'Battery' }]);
    });

    it('Cancel clears the form and leaves the library unchanged', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      await type('bpm', '150');
      await click(cancel());
      expect(values()).toEqual(['', '', '', '']);
      expect(text(save())).toBe('Save');
      expect(save().disabled).toBe(true);
      expect(rowTexts()).toEqual(['Metallica – One · 140 BPM · max 110']);
      expect(stored()).toEqual([one]);
    });

    it('removing the song being edited clears the form and leaves edit mode', async () => {
      seed([one, battery]);
      await setup();
      await click(button('Edit Metallica – One'));
      await click(button('Remove Metallica – One'));
      expect(rowTexts()).toEqual(['Metallica – Battery · 190 BPM']);
      expect(values()).toEqual(['', '', '', '']);
      expect(text(save())).toBe('Save');
      expect(cancel()).toBeNull();
    });

    it('removing another song keeps edit mode', async () => {
      seed([one, battery]);
      await setup();
      await click(button('Edit Metallica – One'));
      await click(button('Remove Metallica – Battery'));
      expect(values()).toEqual(['Metallica', 'One', '140', '110']);
      expect(text(save())).toBe('Update');
    });

    it('does not overwrite a field while the user types', async () => {
      seed([one]);
      await setup();
      await click(button('Edit Metallica – One'));
      field('bpm').value = '';
      field('bpm').dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(field('bpm').value).toBe('');
      expect(save().disabled).toBe(true);
      await type('artist', 'Metal');
      expect(field('artist').value).toBe('Metal');
      expect(field('bpm').value).toBe('');
    });

    it('an update whose write fails still updates the row and shows the hint', async () => {
      seed([one]);
      await setup();
      failWrites = true;
      await click(button('Edit Metallica – One'));
      await type('bpm', '150');
      await submit();
      expect(rowTexts()).toEqual(['Metallica – One · 150 BPM · max 110']);
      expect(hint()).toBe('Songs could not be saved');
    });
  });
});
