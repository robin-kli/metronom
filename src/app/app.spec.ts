import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('renders the settings form with defaults', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const values = Array.from(el.querySelectorAll('input')).map((i) => i.value);
    expect(values).toEqual(['60', '120', '5', '4']);
  });
});
