import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DEFAULT_SETTINGS, Settings } from '../../core/settings';
import { SettingsForm } from './settings-form';

@Component({
  imports: [SettingsForm],
  template: `<app-settings-form [(settings)]="settings" (start)="starts = starts + 1" />`,
})
class Host {
  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  starts = 0;
}

describe('SettingsForm', () => {
  let fixture: ComponentFixture<Host>;
  let el: HTMLElement;

  const inputs = () => Array.from(el.querySelectorAll('input'));
  const button = () => el.querySelector('button.start') as HTMLButtonElement;
  const hint = () => (el.querySelector('.hint') as HTMLElement).textContent?.trim();

  async function type(index: number, value: string) {
    const input = inputs()[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders the four labelled fields with defaults', () => {
    const labels = Array.from(el.querySelectorAll('.label')).map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Start BPM', 'Ceiling BPM', 'Step (BPM)', 'Every (bars)']);
    expect(inputs().map((i) => i.value)).toEqual(['60', '120', '5', '4']);
    expect(button().disabled).toBe(false);
    expect(hint()).toBe('');
  });

  it('has a polite live region for the hint', () => {
    expect(el.querySelector('.hint')?.getAttribute('aria-live')).toBe('polite');
  });

  it('emits start when Start is pressed with valid settings', async () => {
    button().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.starts).toBe(1);
  });

  it('writes edits back to the bound settings signal', async () => {
    await type(0, '80');
    expect(fixture.componentInstance.settings().startBpm).toBe(80);
  });

  it('disables Start and shows the whole-number message for an empty field', async () => {
    await type(1, '');
    expect(fixture.componentInstance.settings().ceilingBpm).toBeNull();
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('All fields need a whole number above 0');
  });

  it('shows the ceiling message when ceiling is below start', async () => {
    await type(0, '120');
    await type(1, '100');
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('Ceiling must be at least the start BPM');
  });

  it('shows only the first problem when there are two', async () => {
    await type(0, '0');
    await type(1, '-5');
    expect(hint()).toBe('All fields need a whole number above 0');
  });

  it('maps a non-numeric value to null and disables Start', async () => {
    const ngModel = fixture.debugElement.queryAll(By.directive(NgModel))[3].injector.get(NgModel);
    ngModel.viewToModelUpdate(Number.NaN);
    await fixture.whenStable();
    expect(fixture.componentInstance.settings().interval).toBeNull();
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('All fields need a whole number above 0');
  });

  it('links each input to the hint', () => {
    expect(inputs().every((i) => i.getAttribute('aria-describedby') === 'settings-hint')).toBe(
      true,
    );
    expect(el.querySelector('#settings-hint')).not.toBeNull();
  });

  it('rejects decimals', async () => {
    await type(0, '60.5');
    expect(button().disabled).toBe(true);
    expect(hint()).toBe('All fields need a whole number above 0');
  });

  it('re-enables Start and clears the hint once fixed', async () => {
    await type(2, '0');
    expect(button().disabled).toBe(true);
    await type(2, '5');
    expect(button().disabled).toBe(false);
    expect(hint()).toBe('');
  });
});
