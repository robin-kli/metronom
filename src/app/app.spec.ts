import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Scheduler, SchedulerOptions } from './audio/scheduler';
import { BeatEvent } from './core/beat-event';
import { SESSION_PLATFORM, SessionPlatform } from './session/session-platform';
import { SessionService } from './session/session.service';
import { TAP_CLOCK } from './session/tap-tempo.service';
import { SONG_STORAGE, SONG_STORAGE_KEY } from './session/song-library.service';

describe('App', () => {
  let stops: number;
  let starts: number;
  let failResume: boolean;
  let onEvent: ((event: BeatEvent) => void) | null;
  let startOptions: (SchedulerOptions | undefined)[];
  let frame: (() => void) | null;
  let songData: Map<string, string>;

  beforeEach(async () => {
    stops = 0;
    starts = 0;
    failResume = false;
    onEvent = null;
    startOptions = [];
    frame = null;
    songData = new Map();
    const platform: SessionPlatform = {
      createAudioContext: () => ({
        currentTime: 0,
        resume: async () => {
          if (failResume) throw new Error('no device');
        },
        suspend: async () => undefined,
      }),
      createScheduler: () => ({
        start: (_settings, cb, options) => {
          starts++;
          startOptions.push(options);
          onEvent = cb;
        },
        stop: () => stops++,
      }),
      requestAnimationFrame: (cb) => {
        frame = cb;
        return 1;
      },
      cancelAnimationFrame: () => undefined,
    };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SESSION_PLATFORM, useValue: platform },
        {
          provide: SONG_STORAGE,
          useValue: {
            getItem: (k: string) => songData.get(k) ?? null,
            setItem: (k: string, v: string) => songData.set(k, v),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the settings form with defaults', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const values = Array.from(el.querySelectorAll<HTMLInputElement>('app-settings-form input')).map(
      (i) => i.value,
    );
    expect(values).toEqual(['60', '120', '5', '4']);
  });

  it('swaps the form for the strip while playing and back on Stop, keeping settings', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    const first = el.querySelector('input') as HTMLInputElement;
    first.value = '80';
    first.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(TestBed.inject(SessionService).settings().startBpm).toBe(80);

    (el.querySelector('button.start') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('app-settings-form')).toBeNull();
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      '80 → 120 BPM · +5 every 4 bars · count-in',
    );
    expect(el.querySelector('app-beat-display .bpm-value')?.textContent?.trim()).toBe('80');
    expect(el.querySelector('.block.lit')).toBeNull();

    onEvent!({
      audioTime: 0,
      beat: 1,
      barIndex: 0,
      tempo: 85,
      hold: false,
      barsToNext: 4,
      countIn: false,
    });
    frame!();
    await fixture.whenStable();
    expect(el.querySelector('.block.lit')?.getAttribute('data-beat')).toBe('1');
    expect(el.querySelector('app-beat-display .bpm-value')?.textContent?.trim()).toBe('85');
    expect(el.querySelector('app-beat-display .status')?.textContent?.trim()).toBe('4 bars to +5');

    (el.querySelector('button.stop') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(stops).toBe(1);
    expect(el.querySelector('app-settings-strip')).toBeNull();
    expect(
      Array.from(el.querySelectorAll<HTMLInputElement>('app-settings-form input')).map(
        (i) => i.value,
      ),
    ).toEqual(['80', '120', '5', '4']);
  });

  it('opens with the Count-in switch on and starts with a count-in', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    expect(el.querySelector('button.count-in')?.getAttribute('aria-checked')).toBe('true');
    (el.querySelector('button.start') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
    expect(startOptions).toEqual([{ countIn: true }]);
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      '60 → 120 BPM · +5 every 4 bars · count-in',
    );
    onEvent!({
      audioTime: 0,
      beat: 1,
      barIndex: -1,
      tempo: 60,
      hold: false,
      barsToNext: 0,
      countIn: true,
    });
    frame!();
    await fixture.whenStable();
    expect(el.querySelector('app-beat-display .status')?.textContent?.trim()).toBe('Count-in');
    expect(el.querySelector('app-beat-display .bpm-value')?.textContent?.trim()).toBe('60');
  });

  it('with the switch off, the first published event is a ramp beat', async () => {
    // Real scheduler on a fake clock, so the toggle's effect on what is published is end-to-end.
    const clock = { currentTime: 0 };
    const timer: { tick: (() => void) | null } = { tick: null };
    const real = new Scheduler(
      clock,
      {
        setTimeout: (fn) => {
          timer.tick = fn;
          return 1;
        },
        clearTimeout: () => (timer.tick = null),
      },
      () => ({ cancel: () => undefined }),
    );
    const raf: { publish: (() => void) | null } = { publish: null };
    TestBed.overrideProvider(SESSION_PLATFORM, {
      useValue: {
        createAudioContext: () => ({
          get currentTime() {
            return clock.currentTime;
          },
          resume: async () => undefined,
          suspend: async () => undefined,
        }),
        createScheduler: () => real,
        requestAnimationFrame: (cb: () => void) => {
          raf.publish = cb;
          return 1;
        },
        cancelAnimationFrame: () => undefined,
      } satisfies SessionPlatform,
    });
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    (el.querySelector('button.count-in') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('button.count-in')?.getAttribute('aria-checked')).toBe('false');
    (el.querySelector('button.start') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      '60 → 120 BPM · +5 every 4 bars',
    );
    clock.currentTime = 0.06;
    timer.tick?.();
    raf.publish?.();
    await fixture.whenStable();
    const session = TestBed.inject(SessionService);
    expect(session.current()).toMatchObject({ barIndex: 0, beat: 1, countIn: false });
    expect(el.querySelector('app-beat-display .status')?.textContent?.trim()).toBe('4 bars to +5');
    session.stop();
  });

  it('keeps the form and shows the audio error when audio fails', async () => {
    failResume = true;
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    (el.querySelector('button.start') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(el.querySelector('app-settings-form')).not.toBeNull();
    expect(el.querySelector('app-settings-strip')).toBeNull();
    expect(el.querySelector('.hint')?.textContent?.trim()).toBe('No audio output available');
  });

  describe('song library', () => {
    function storeSongs() {
      songData.set(
        SONG_STORAGE_KEY,
        JSON.stringify([
          { artist: 'Metallica', title: 'One', bpm: 140 },
          { artist: 'Slayer', title: 'Seasons', bpm: 90 },
        ]),
      );
    }
    const settingsValues = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLInputElement>('app-settings-form input')).map(
        (i) => (i as HTMLInputElement).value,
      );
    const pick = (el: HTMLElement, index: number) =>
      (el.querySelectorAll('app-song-library .pick')[index] as HTMLButtonElement).click();

    it('lists stored songs on launch under the settings form', async () => {
      storeSongs();
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      const idle = el.querySelector('main.idle')!;
      expect(Array.from(idle.children).map((c) => c.tagName.toLowerCase())).toEqual([
        'app-settings-form',
        'app-song-library',
      ]);
      expect(el.querySelectorAll('app-song-library .row')).toHaveLength(2);
    });

    it('selecting a row sets the Ceiling field, and Start ramps towards it', async () => {
      storeSongs();
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      pick(el, 0);
      await fixture.whenStable();
      expect(settingsValues(el)).toEqual(['60', '140', '5', '4']);
      (el.querySelector('button.start') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
      expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
        '60 → 140 BPM · +5 every 4 bars · count-in',
      );
      expect(el.querySelector('app-song-library')).toBeNull();
    });

    it('selecting a song below the Start BPM lowers Start to it', async () => {
      storeSongs();
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      const start = el.querySelector('app-settings-form input') as HTMLInputElement;
      start.value = '100';
      start.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      pick(el, 1);
      await fixture.whenStable();
      expect(settingsValues(el)).toEqual(['90', '90', '5', '4']);
    });

    it('Space in the Artist and Song fields types normally and does not start', async () => {
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      await fixture.whenStable();
      for (const name of ['artist', 'title']) {
        const input = el.querySelector(
          `app-song-library input[name="${name}"]`,
        ) as HTMLInputElement;
        input.focus();
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        input.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
      expect(TestBed.inject(SessionService).status()).toBe('idle');
      expect(starts).toBe(0);
      fixture.destroy();
      el.remove();
    });

    it('a native select event in the Artist field leaves the Settings unchanged', async () => {
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      const input = el.querySelector('app-song-library input[name="artist"]') as HTMLInputElement;
      input.dispatchEvent(new Event('select', { bubbles: true }));
      await fixture.whenStable();
      expect(TestBed.inject(SessionService).settings()).toEqual({
        startBpm: 60,
        ceilingBpm: 120,
        step: 5,
        interval: 4,
      });
      expect(settingsValues(el)).toEqual(['60', '120', '5', '4']);
    });

    it.each([
      ['the BPM field', 'app-song-library input[name="bpm"]'],
      ['a song row', 'app-song-library .pick'],
    ])('Space on %s is swallowed and starts the Session', async (_name, selector) => {
      storeSongs();
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      await fixture.whenStable();
      const target = el.querySelector(selector) as HTMLElement;
      target.focus();
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
      expect(TestBed.inject(SessionService).status()).toBe('playing');
      expect(starts).toBe(1);
      TestBed.inject(SessionService).stop();
      fixture.destroy();
      el.remove();
    });

    it('Enter in a song field does not start the Session', async () => {
      const fixture = TestBed.createComponent(App);
      const el = fixture.nativeElement as HTMLElement;
      await fixture.whenStable();
      const input = el.querySelector('app-song-library input[name="artist"]') as HTMLInputElement;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r));
      expect(starts).toBe(0);
    });
  });

  describe('keyboard', () => {
    function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event;
    }

    async function setup() {
      const fixture = TestBed.createComponent(App);
      current = fixture;
      const el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      await fixture.whenStable();
      const session = TestBed.inject(SessionService);
      const settle = async () => {
        // Let start()'s awaited resume() resolve, then re-render.
        await new Promise((r) => setTimeout(r));
        await fixture.whenStable();
      };
      const inputs = () =>
        Array.from(el.querySelectorAll<HTMLInputElement>('app-settings-form input'));
      const makeInvalid = async () => {
        const first = inputs()[0];
        first.value = '';
        first.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };
      const play = async () => {
        await session.start();
        await fixture.whenStable();
        expect(session.status()).toBe('playing');
      };
      return { fixture, el, session, settle, inputs, makeInvalid, play };
    }

    let current: { destroy(): void } | null = null;

    afterEach(() => {
      current?.destroy();
      current = null;
      document.querySelectorAll('app-root').forEach((n) => n.remove());
    });

    it('Space in a field starts, leaves the value unchanged and prevents default', async () => {
      const { session, settle, inputs } = await setup();
      const ceiling = inputs()[1];
      ceiling.focus();
      const event = key(ceiling, ' ');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.status()).toBe('playing');
      expect(session.settings().ceilingBpm).toBe(120);
      expect(starts).toBe(1);
    });

    it('Space on the focused Count-in switch starts playback and does not toggle it', async () => {
      const { el, session, settle } = await setup();
      const toggle = el.querySelector('button.count-in') as HTMLButtonElement;
      toggle.focus();
      const event = key(toggle, ' ');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.status()).toBe('playing');
      expect(session.countIn()).toBe(true);
      expect(starts).toBe(1);
    });

    it('Space while playing stops and the form returns', async () => {
      const { el, session, settle, play } = await setup();
      await play();
      const event = key(el.querySelector('button.stop')!, ' ');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.status()).toBe('idle');
      expect(stops).toBe(1);
      expect(el.querySelector('app-settings-form')).not.toBeNull();
    });

    it('Space on the focused Start button starts exactly once', async () => {
      const { el, session, settle } = await setup();
      const start = el.querySelector('button.start') as HTMLButtonElement;
      start.focus();
      const event = key(start, ' ');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.status()).toBe('playing');
      expect(starts).toBe(1);
    });

    it('Space with invalid Settings does nothing and keeps the hint', async () => {
      const { el, session, settle, inputs, makeInvalid } = await setup();
      await makeInvalid();
      const event = key(inputs()[0], ' ');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.status()).toBe('idle');
      expect(starts).toBe(0);
      expect(el.querySelector('.hint')?.textContent?.trim()).toBe(
        'All fields need a whole number above 0',
      );
    });

    it('ignores auto-repeated Space while playing', async () => {
      const { session, settle, play } = await setup();
      await play();
      const repeat = key(window, ' ', { repeat: true });
      key(window, ' ', { repeat: true });
      await settle();
      expect(repeat.defaultPrevented).toBe(true);
      expect(session.status()).toBe('playing');
      expect(stops).toBe(0);
      key(window, ' ');
      await settle();
      expect(session.status()).toBe('idle');
      expect(stops).toBe(1);
    });

    it('ignores Enter during IME composition', async () => {
      const { session, settle, inputs } = await setup();
      key(inputs()[0], 'Enter', { isComposing: true });
      await settle();
      expect(session.status()).toBe('idle');
      expect(starts).toBe(0);
    });

    it('ignores Enter with Ctrl, Alt or Meta in a field', async () => {
      const { session, settle, inputs } = await setup();
      for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        key(inputs()[0], 'Enter', { [mod]: true });
      }
      await settle();
      expect(session.status()).toBe('idle');
      expect(starts).toBe(0);
    });

    it('ignores Escape with Ctrl, Alt or Meta while playing', async () => {
      const { session, settle, play } = await setup();
      await play();
      for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        key(window, 'Escape', { [mod]: true });
      }
      await settle();
      expect(session.status()).toBe('playing');
      expect(stops).toBe(0);
    });

    it('Enter in a field starts', async () => {
      const { session, settle, inputs } = await setup();
      key(inputs()[2], 'Enter');
      await settle();
      expect(session.status()).toBe('playing');
    });

    it('Enter in a field with invalid Settings does nothing', async () => {
      const { session, settle, inputs, makeInvalid } = await setup();
      await makeInvalid();
      key(inputs()[0], 'Enter');
      await settle();
      expect(session.status()).toBe('idle');
      expect(starts).toBe(0);
    });

    it('Enter outside a settings field does not start', async () => {
      const { el, session, settle } = await setup();
      const event = key(el.querySelector('button.start')!, 'Enter');
      key(window, 'Enter');
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(session.status()).toBe('idle');
    });

    it('Escape while playing stops', async () => {
      const { session, settle, play } = await setup();
      await play();
      key(window, 'Escape');
      await settle();
      expect(session.status()).toBe('idle');
      expect(stops).toBe(1);
    });

    it('Escape while idle does nothing', async () => {
      const { session, settle } = await setup();
      key(window, 'Escape');
      await settle();
      expect(session.status()).toBe('idle');
      expect(stops).toBe(0);
    });

    it('ArrowUp / ArrowDown shift Start and Ceiling together and prevent default', async () => {
      const { session, settle, inputs } = await setup();
      const up = key(window, 'ArrowUp');
      await settle();
      expect(up.defaultPrevented).toBe(true);
      expect(session.settings()).toEqual({ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 });
      expect(inputs().map((i) => i.value)).toEqual(['61', '121', '5', '4']);
      key(window, 'ArrowDown', { repeat: true });
      key(window, 'ArrowDown', { repeat: true });
      await settle();
      expect(session.settings()).toEqual({ startBpm: 59, ceilingBpm: 119, step: 5, interval: 4 });
    });

    it('ArrowUp in a settings field shifts the range instead of that field', async () => {
      const { session, settle, inputs } = await setup();
      const step = inputs()[2];
      step.focus();
      const event = key(step, 'ArrowUp');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.settings()).toEqual({ startBpm: 61, ceilingBpm: 121, step: 5, interval: 4 });
    });

    it('ArrowDown at Start 1 and with an empty Start changes nothing', async () => {
      const { session, settle, makeInvalid } = await setup();
      session.updateSettings({ startBpm: 1, ceilingBpm: 40, step: 5, interval: 4 });
      key(window, 'ArrowDown');
      await settle();
      expect(session.settings()).toEqual({ startBpm: 1, ceilingBpm: 40, step: 5, interval: 4 });
      await makeInvalid();
      key(window, 'ArrowUp');
      await settle();
      expect(session.settings()).toEqual({ startBpm: null, ceilingBpm: 40, step: 5, interval: 4 });
    });

    it('arrows in a song library field keep their native behaviour', async () => {
      const { el, session, settle } = await setup();
      const songBpm = el.querySelector('app-song-library input[name="bpm"]') as HTMLInputElement;
      songBpm.focus();
      const event = key(songBpm, 'ArrowUp');
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(session.settings().startBpm).toBe(60);
      expect(session.settings().ceilingBpm).toBe(120);
    });

    it('arrows on a focused song library button still shift the range', async () => {
      const { el, session, settle } = await setup();
      const save = el.querySelector('app-song-library button') as HTMLButtonElement;
      const event = key(save, 'ArrowUp');
      await settle();
      expect(event.defaultPrevented).toBe(true);
      expect(session.settings().startBpm).toBe(61);
    });

    it('arrows do nothing while playing or with Ctrl, Alt or Meta', async () => {
      const { session, settle, play } = await setup();
      for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        expect(key(window, 'ArrowUp', { [mod]: true }).defaultPrevented).toBe(false);
      }
      await settle();
      expect(session.settings().startBpm).toBe(60);
      await play();
      key(window, 'ArrowUp');
      key(window, 'ArrowDown');
      await settle();
      expect(session.settings().startBpm).toBe(60);
      expect(session.settings().ceilingBpm).toBe(120);
    });

    it('ignores Space with Ctrl, Alt or Meta', async () => {
      const { session, settle, inputs } = await setup();
      for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        const event = key(inputs()[0], ' ', { [mod]: true });
        expect(event.defaultPrevented).toBe(false);
      }
      await settle();
      expect(session.status()).toBe('idle');
      expect(starts).toBe(0);
    });
  });
  describe('ramp switch and tap tempo', () => {
    let clock: number;
    let current: { destroy(): void } | null = null;

    function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const event = new KeyboardEvent('keydown', {
        key: k,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      target.dispatchEvent(event);
      return event;
    }

    async function setup() {
      clock = 0;
      TestBed.overrideProvider(TAP_CLOCK, { useValue: () => clock });
      const fixture = TestBed.createComponent(App);
      current = fixture;
      const el = fixture.nativeElement as HTMLElement;
      document.body.appendChild(el);
      await fixture.whenStable();
      const session = TestBed.inject(SessionService);
      const settle = async () => {
        await new Promise((r) => setTimeout(r));
        await fixture.whenStable();
      };
      const values = () =>
        Array.from(el.querySelectorAll<HTMLInputElement>('app-settings-form input')).map(
          (i) => i.value,
        );
      const rampOff = async () => {
        (el.querySelector('button.ramp') as HTMLButtonElement).click();
        await fixture.whenStable();
      };
      return { fixture, el, session, settle, values, rampOff };
    }

    afterEach(() => {
      current?.destroy();
      current = null;
      document.querySelectorAll('app-root').forEach((n) => n.remove());
    });

    it('Ramp off: Space plays every bar at Tempo with the constant texts', async () => {
      const { el, session, settle, values, rampOff } = await setup();
      await rampOff();
      expect(session.ramp()).toBe(false);
      expect(values()).toEqual(['60']);
      const tempo = el.querySelector('app-settings-form input') as HTMLInputElement;
      tempo.value = '90';
      tempo.dispatchEvent(new Event('input'));
      await settle();
      key(window, ' ');
      await settle();
      expect(session.status()).toBe('playing');
      expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
        '90 BPM · constant · count-in',
      );
      onEvent!({
        audioTime: 0,
        beat: 1,
        barIndex: 0,
        tempo: 90,
        hold: true,
        barsToNext: 0,
        countIn: false,
      });
      frame!();
      await settle();
      expect(el.querySelector('app-beat-display .status')?.textContent?.trim()).toBe(
        'Steady at 90 BPM',
      );
      session.stop();
      await settle();
      expect(values()).toEqual(['90']);
    });

    it('Ramp off: arrows shift the Tempo only', async () => {
      const { session, settle, rampOff } = await setup();
      await rampOff();
      expect(key(window, 'ArrowUp').defaultPrevented).toBe(true);
      await settle();
      expect(session.settings()).toMatchObject({ startBpm: 61, ceilingBpm: 120 });
      key(window, 'ArrowDown');
      key(window, 'ArrowDown');
      await settle();
      expect(session.settings()).toMatchObject({ startBpm: 59, ceilingBpm: 120 });
    });

    it('Ramp off: a song sets the Tempo and leaves the hidden Ceiling alone', async () => {
      songData.set(
        SONG_STORAGE_KEY,
        JSON.stringify([{ artist: 'Metallica', title: 'One', bpm: 140 }]),
      );
      const { el, session, settle, values, rampOff } = await setup();
      await rampOff();
      (el.querySelector('app-song-library .pick') as HTMLButtonElement).click();
      await settle();
      expect(values()).toEqual(['140']);
      expect(session.settings()).toMatchObject({ startBpm: 140, ceilingBpm: 120 });
      // Switching Ramp back on raises the Ceiling to Start.
      (el.querySelector('button.ramp') as HTMLButtonElement).click();
      await settle();
      expect(values()).toEqual(['140', '140', '5', '4']);
    });

    it('T five times 500 ms apart: Start reads 120, readout "120" and "5 taps"', async () => {
      const { el, settle, values } = await setup();
      for (let i = 0; i < 5; i++) {
        clock = i * 500;
        expect(key(window, i % 2 ? 'T' : 't').defaultPrevented).toBe(true);
      }
      await settle();
      expect(values()[0]).toBe('120');
      expect(el.querySelector('.tap-value')?.textContent?.trim()).toBe('120');
      expect(el.querySelector('.tap-count')?.textContent?.trim()).toBe('5 taps');
    });

    it('T in a settings field taps and never types', async () => {
      const { el, session, settle } = await setup();
      const start = el.querySelector('app-settings-form input') as HTMLInputElement;
      start.focus();
      expect(key(start, 't').defaultPrevented).toBe(true);
      clock = 400;
      key(start, 't');
      await settle();
      expect(session.settings()).toMatchObject({ startBpm: 150, ceilingBpm: 150 });
    });

    it('T in the Artist field types a "t" and does not tap', async () => {
      const { el, settle } = await setup();
      const artist = el.querySelector('app-song-library input[name="artist"]') as HTMLInputElement;
      artist.focus();
      expect(key(artist, 't').defaultPrevented).toBe(false);
      await settle();
      expect(el.querySelector('.tap-count')?.textContent?.trim()).toBe('Tap at least twice');
      expect(TestBed.inject(SessionService).settings().startBpm).toBe(60);
    });

    it('T ignores key repeat, modifiers and Playing', async () => {
      const { session, settle } = await setup();
      key(window, 't');
      clock = 500;
      key(window, 't', { repeat: true });
      for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) {
        expect(key(window, 't', { [mod]: true }).defaultPrevented).toBe(false);
      }
      await settle();
      expect(session.settings().startBpm).toBe(60);
      await session.start();
      await settle();
      clock = 600;
      key(window, 't');
      clock = 1100;
      key(window, 't');
      await settle();
      expect(session.settings().startBpm).toBe(60);
      session.stop();
    });
  });
});
