import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Settings } from '../../core/settings';
import { SettingsStrip } from './settings-strip';

@Component({
  imports: [SettingsStrip],
  template: `<app-settings-strip
    [settings]="settings()"
    [countIn]="countIn()"
    [ramp]="ramp()"
    (stop)="stops = stops + 1"
  />`,
})
class Host {
  readonly settings = signal<Settings>({ startBpm: 60, ceilingBpm: 120, step: 5, interval: 4 });
  readonly countIn = signal(false);
  readonly ramp = signal(true);
  stops = 0;
}

describe('SettingsStrip', () => {
  it('summarises the settings and emits stop', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe(
      '60 → 120 BPM · +5 every 4 bars',
    );
    (el.querySelector('button.stop') as HTMLButtonElement).click();
    expect(fixture.componentInstance.stops).toBe(1);
  });

  it('appends count-in when it is on', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.countIn.set(true);
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.summary')?.textContent?.trim(),
    ).toBe('60 → 120 BPM · +5 every 4 bars · count-in');
  });

  it('uses the singular for a one-bar interval', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.settings.set({ startBpm: 60, ceilingBpm: 72, step: 6, interval: 1 });
    await fixture.whenStable();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.summary')?.textContent?.trim(),
    ).toBe('60 → 72 BPM · +6 every 1 bar');
  });

  it('reads "{n} BPM · constant" with Ramp off, plus count-in', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.ramp.set(false);
    fixture.componentInstance.settings.set({
      startBpm: 90,
      ceilingBpm: null,
      step: null,
      interval: 4,
    });
    await fixture.whenStable();
    const summary = () =>
      (fixture.nativeElement as HTMLElement).querySelector('.summary')?.textContent?.trim();
    expect(summary()).toBe('90 BPM · constant');
    fixture.componentInstance.countIn.set(true);
    await fixture.whenStable();
    expect(summary()).toBe('90 BPM · constant · count-in');
  });
});
