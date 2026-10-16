import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { BeatEvent } from './core/beat-event';
import { SESSION_PLATFORM, SessionPlatform } from './session/session-platform';
import { SessionService } from './session/session.service';

describe('App', () => {
  let stops: number;
  let failResume: boolean;
  let onEvent: ((event: BeatEvent) => void) | null;
  let frame: (() => void) | null;

  beforeEach(async () => {
    stops = 0;
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
});
