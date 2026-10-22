import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DEFAULT_SETTINGS, Settings } from '../../core/settings';
import { SettingsForm } from './settings-form';

@Component({
  imports: [SettingsForm],
  template: `<app-settings-form
    [(settings)]="settings"
    [(countIn)]="countIn"
    (start)="starts = starts + 1"
  />`,
})
class Host {
  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  readonly countIn = signal(true);
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

  it('shows a Count-in switch, on, between the fields and Start', () => {
    const toggle = el.querySelector('button.count-in') as HTMLButtonElement;
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('Count-in');
    const order = Array.from(el.querySelector('app-settings-form')!.children).map(
      (c) => c.className.split(' ')[0],
    );
    expect(order.indexOf('count-in')).toBeGreaterThan(order.indexOf('fields'));
    expect(order.indexOf('count-in')).toBeLessThan(order.indexOf('start'));
  });

  it('toggles the count-in on click and writes it back, without starting', async () => {
    const toggle = el.querySelector('button.count-in') as HTMLButtonElement;
    toggle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.countIn()).toBe(false);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.countIn()).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(fixture.componentInstance.starts).toBe(0);
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

  describe('steppers', () => {
    const stepper = (label: string, dir: 'Increase' | 'Decrease') =>
      el.querySelector(`button[aria-label="${dir} ${label}"]`) as HTMLButtonElement;

    async function click(label: string, dir: 'Increase' | 'Decrease') {
      stepper(label, dir).click();
      await fixture.whenStable();
    }

    it('renders a −/+ pair under each field, outside the Tab order', () => {
      const pairs = Array.from(el.querySelectorAll('.field')).map((f) =>
        Array.from(f.querySelectorAll('.stepper button')).map((b) => b.getAttribute('aria-label')),
      );
      expect(pairs).toEqual([
        ['Decrease Start BPM', 'Increase Start BPM'],
        ['Decrease Ceiling BPM', 'Increase Ceiling BPM'],
        ['Decrease Step (BPM)', 'Increase Step (BPM)'],
        ['Decrease Every (bars)', 'Increase Every (bars)'],
      ]);
      for (const b of Array.from(el.querySelectorAll<HTMLButtonElement>('.stepper button'))) {
        expect(b.type).toBe('button');
        expect(b.tabIndex).toBe(-1);
      }
    });

    it('+ and − change only their own field by 1', async () => {
      await click('Step (BPM)', 'Increase');
      expect(fixture.componentInstance.settings()).toEqual({ ...DEFAULT_SETTINGS, step: 6 });
      expect(inputs().map((i) => i.value)).toEqual(['60', '120', '6', '4']);
      await click('Ceiling BPM', 'Decrease');
      expect(fixture.componentInstance.settings()).toEqual({
        ...DEFAULT_SETTINGS,
        step: 6,
        ceilingBpm: 119,
      });
      expect(fixture.componentInstance.starts).toBe(0);
    });

    it('disables − at 1 and on an empty field; + on an empty field gives 1', async () => {
      await type(3, '2');
      await click('Every (bars)', 'Decrease');
      expect(fixture.componentInstance.settings().interval).toBe(1);
      expect(stepper('Every (bars)', 'Decrease').disabled).toBe(true);
      await type(1, '');
      expect(stepper('Ceiling BPM', 'Decrease').disabled).toBe(true);
      await click('Ceiling BPM', 'Increase');
      expect(fixture.componentInstance.settings().ceilingBpm).toBe(1);
      await type(2, '-5');
      await click('Step (BPM)', 'Increase');
      expect(fixture.componentInstance.settings().step).toBe(1);
    });

    it('does not take focus away from a field on mousedown', () => {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      stepper('Start BPM', 'Increase').dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  it('re-enables Start and clears the hint once fixed', async () => {
    await type(2, '0');
    expect(button().disabled).toBe(true);
    await type(2, '5');
    expect(button().disabled).toBe(false);
    expect(hint()).toBe('');
  });
});

@Component({
  imports: [SettingsForm],
  template: `<app-settings-form [(settings)]="settings" [countIn]="true" [extraHint]="extra()" />`,
})
class ExtraHintHost {
  readonly settings = signal<Settings>({ ...DEFAULT_SETTINGS });
  readonly extra = signal<string | null>('No audio output available');
}

describe('SettingsForm extraHint', () => {
  it('shows the extra hint when settings are valid, validation message otherwise', async () => {
    const fixture = TestBed.createComponent(ExtraHintHost);
    const el = fixture.nativeElement as HTMLElement;
    const hint = () => el.querySelector('.hint')?.textContent?.trim();
    await fixture.whenStable();
    expect(hint()).toBe('No audio output available');
    fixture.componentInstance.settings.set({ ...DEFAULT_SETTINGS, step: null });
    await fixture.whenStable();
    expect(hint()).toBe('All fields need a whole number above 0');
  });
});
