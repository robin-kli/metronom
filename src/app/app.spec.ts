import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { BeatEvent } from './core/beat-event';
import { SESSION_PLATFORM, SessionPlatform } from './session/session-platform';
import { SessionService } from './session/session.service';

describe('App', () => {
  let stops: number;
  let starts: number;
  let failResume: boolean;
  let onEvent: ((event: BeatEvent) => void) | null;
  let frame: (() => void) | null;

  beforeEach(async () => {
    stops = 0;
    starts = 0;
    failResume = false;
    onEvent = null;
    frame = null;
    const platform: SessionPlatform = {
      createAudioContext: () => ({
        currentTime: 0,
        resume: async () => {
          if (failResume) throw new Error('no device');
        },
        suspend: async () => undefined,
      }),
      createScheduler: () => ({
        start: (_settings, cb) => {
          starts++;
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
      providers: [{ provide: SESSION_PLATFORM, useValue: platform }],
    }).compileComponents();
  });

  it('renders the settings form with defaults', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const values = Array.from(el.querySelectorAll('input')).map((i) => i.value);
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
      '80 → 120 BPM · +5 every 4 bars',
    );
    expect(el.querySelector('app-beat-display .bpm-value')?.textContent?.trim()).toBe('80');
    expect(el.querySelector('.block.lit')).toBeNull();

    onEvent!({ audioTime: 0, beat: 1, barIndex: 0, tempo: 85, hold: false, barsToNext: 4 });
    frame!();
    await fixture.whenStable();
    expect(el.querySelector('.block.lit')?.getAttribute('data-beat')).toBe('1');
    expect(el.querySelector('app-beat-display .bpm-value')?.textContent?.trim()).toBe('85');
    expect(el.querySelector('app-beat-display .status')?.textContent?.trim()).toBe('4 bars to +5');

    (el.querySelector('button.stop') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(stops).toBe(1);
    expect(el.querySelector('app-settings-strip')).toBeNull();
    expect(Array.from(el.querySelectorAll('input')).map((i) => i.value)).toEqual([
      '80',
      '120',
      '5',
      '4',
    ]);
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
      const inputs = () => Array.from(el.querySelectorAll('input'));
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
});
