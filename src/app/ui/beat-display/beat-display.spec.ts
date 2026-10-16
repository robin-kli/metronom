import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BeatEvent } from '../../core/beat-event';
import { BeatDisplay } from './beat-display';

@Component({
  imports: [BeatDisplay],
  template: `<app-beat-display [event]="event()" [startBpm]="startBpm()" [step]="step()" />`,
})
class Host {
  readonly event = signal<BeatEvent | null>(null);
  readonly startBpm = signal(60);
  readonly step = signal(5);
}

function beatEvent(partial: Partial<BeatEvent>): BeatEvent {
  return { audioTime: 0, beat: 1, barIndex: 0, tempo: 60, hold: false, barsToNext: 4, ...partial };
}

async function setup(event: BeatEvent | null = null) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.event.set(event);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el };
}

const text = (el: HTMLElement, selector: string) =>
  el.querySelector(selector)?.textContent?.trim() ?? null;
const lit = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.block.lit')).map((b) => b.getAttribute('data-beat'));

describe('BeatDisplay', () => {
  it('before the first beat: nothing lit, start BPM, empty status', async () => {
    const { el } = await setup(null);
    expect(lit(el)).toEqual([]);
    expect(text(el, '.bpm-value')).toBe('60');
    expect(text(el, '.bpm-label')).toBe('BPM');
    expect(text(el, '.status')).toBe('');
    expect(el.querySelectorAll('.block').length).toBe(4);
    // Beat 1 always carries the accent outline class.
    expect(el.querySelector('.block[data-beat="1"]')?.classList).toContain('accent');
    expect(el.querySelectorAll('.block.accent').length).toBe(1);
  });

  it('ramping on beat 1: block 1 lit with accent, BPM and countdown', async () => {
    const { el } = await setup(beatEvent({ beat: 1, tempo: 60, barsToNext: 4 }));
    expect(lit(el)).toEqual(['1']);
    expect(el.querySelector('.block.lit')?.classList).toContain('accent');
    expect(text(el, '.bpm-value')).toBe('60');
    expect(text(el, '.status')).toBe('4 bars to +5');
  });

  it('ramping on beat 3 in the last bar: block 3 lit without accent, singular copy', async () => {
    const { el } = await setup(beatEvent({ beat: 3, barsToNext: 1 }));
    expect(lit(el)).toEqual(['3']);
    expect(el.querySelector('.block.lit')?.classList).not.toContain('accent');
    expect(text(el, '.status')).toBe('1 bar to +5');
  });

  it('in Hold shows the holding copy', async () => {
    const { el } = await setup(beatEvent({ beat: 2, tempo: 120, hold: true, barsToNext: 0 }));
    expect(text(el, '.bpm-value')).toBe('120');
    expect(text(el, '.status')).toBe('Holding at 120 BPM');
  });

  it('falls back to the idle look when the event returns to null', async () => {
    const { fixture, el } = await setup(beatEvent({ beat: 2, tempo: 85, barsToNext: 3 }));
    expect(lit(el)).toEqual(['2']);
    fixture.componentInstance.event.set(null);
    await fixture.whenStable();
    expect(lit(el)).toEqual([]);
    expect(text(el, '.bpm-value')).toBe('60');
    expect(text(el, '.status')).toBe('');
  });

  it('announces tempo changes only, and hides the blocks from screen readers', async () => {
    const { fixture, el } = await setup(beatEvent({ beat: 4, tempo: 60 }));
    const live = el.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live.textContent?.trim()).toBe('60 BPM');
    expect(el.querySelector('.blocks')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.bpm')?.getAttribute('aria-hidden')).toBe('true');

    const textNode = live.firstChild;
    let mutations = 0;
    const observer = new MutationObserver((records) => (mutations += records.length));
    observer.observe(live, { characterData: true, childList: true, subtree: true });

    fixture.componentInstance.event.set(beatEvent({ beat: 1, barIndex: 4, tempo: 66 }));
    await fixture.whenStable();
    expect(live.textContent?.trim()).toBe('66 BPM');
    await Promise.resolve();
    const afterChange = mutations;
    expect(afterChange).toBeGreaterThan(0);

    fixture.componentInstance.event.set(beatEvent({ beat: 2, barIndex: 4, tempo: 66 }));
    await fixture.whenStable();
    fixture.componentInstance.event.set(beatEvent({ beat: 3, barIndex: 4, tempo: 66 }));
    await fixture.whenStable();
    await Promise.resolve();
    expect(live.textContent?.trim()).toBe('66 BPM');
    expect(mutations).toBe(afterChange);
    expect(live.firstChild).toBe(textNode);
    observer.disconnect();
  });
});
