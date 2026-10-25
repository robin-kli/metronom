import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SESSION_PLATFORM, SessionPlatform } from '../../session/session-platform';
import { SessionService } from '../../session/session.service';
import { TAP_CLOCK, TapTempoService } from '../../session/tap-tempo.service';
import { TapPad } from './tap-pad';

describe('TapPad', () => {
  let clock: number;
  let fixture: ComponentFixture<TapPad>;
  let el: HTMLElement;

  const button = () => el.querySelector('button.tap') as HTMLButtonElement;
  const text = (selector: string) => el.querySelector(selector)?.textContent?.trim();

  function pressSync(at: number, init: PointerEventInit = {}) {
    clock = at;
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, ...init });
    button().dispatchEvent(event);
  }

  async function press(at: number, init: PointerEventInit = {}) {
    pressSync(at, init);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    clock = 0;
    const platform: SessionPlatform = {
      createAudioContext: () => ({
        currentTime: 0,
        resume: async () => undefined,
        suspend: async () => undefined,
      }),
      createScheduler: () => ({ start: () => undefined, stop: () => undefined }),
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => undefined,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SESSION_PLATFORM, useValue: platform },
        { provide: TAP_CLOCK, useValue: () => clock },
      ],
    });
    fixture = TestBed.createComponent(TapPad);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders the button and the placeholder readout', () => {
    expect(button().type).toBe('button');
    expect(button().tabIndex).toBe(-1);
    expect(button().getAttribute('aria-label')).toBe('Tap tempo, key T');
    expect(button().getAttribute('aria-keyshortcuts')).toBe('T');
    expect(text('.key-hint')).toBe('T');
    expect(text('.tap-value')).toBe('—');
    expect(text('.tap-unit')).toBe('BPM');
    expect(text('.tap-count')).toBe('Tap at least twice');
    expect(el.querySelector('.readout')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('');
  });

  it('taps on pointer press and shows tempo and count from the second tap', async () => {
    await press(0);
    expect(text('.tap-value')).toBe('—');
    expect(text('.tap-count')).toBe('Tap at least twice');
    await press(500);
    expect(text('.tap-value')).toBe('120');
    expect(text('.tap-count')).toBe('2 taps');
    expect(el.querySelector('.tap-bpm')?.classList).not.toContain('placeholder');
    expect(TestBed.inject(SessionService).settings().startBpm).toBe(120);
  });

  it('ignores a secondary-button press', async () => {
    await press(0, { button: 2 });
    expect(TestBed.inject(TapTempoService).count()).toBe(0);
  });

  it('never takes focus on mousedown', () => {
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    button().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  // Under fake timers whenStable() would wait on mocked timers, so render synchronously.
  it('shows the pressed fill for about 100 ms on every tap, including key taps', () => {
    vi.useFakeTimers();
    try {
      TestBed.inject(TapTempoService).tap();
      fixture.detectChanges();
      expect(button().classList).toContain('pressed');
      vi.advanceTimersByTime(99);
      fixture.detectChanges();
      expect(button().classList).toContain('pressed');
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(button().classList).not.toContain('pressed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces the run politely once it ends', () => {
    vi.useFakeTimers();
    try {
      pressSync(0);
      pressSync(500);
      vi.advanceTimersByTime(2500);
      fixture.detectChanges();
      expect(el.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('Tapped 120 BPM');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not flash when mounted after earlier taps (back to Idle after Stop)', async () => {
    TestBed.inject(TapTempoService).tap();
    fixture.destroy();
    const again = TestBed.createComponent(TapPad);
    await again.whenStable();
    const tap = (again.nativeElement as HTMLElement).querySelector('button.tap')!;
    expect(tap.classList).not.toContain('pressed');
  });
});
