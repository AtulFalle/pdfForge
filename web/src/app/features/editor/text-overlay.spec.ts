import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { TextRun } from '../../core/api/models';
import { EditorStore } from './editor-store';
import { TextOverlay } from './text-overlay';

const run: TextRun = {
  id: '1-0',
  page: 1,
  text: 'Hello',
  bbox: { x: 10, y: 20, width: 40, height: 12 },
  style: { font_name: 'Helvetica', size: 12, color: '#000000' },
  transform: [1, 0, 0, 1, 10, 20],
  source_operators: ['Tj'],
  font_fallback: false,
};

describe('TextOverlay', () => {
  let fixture: ComponentFixture<TextOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextOverlay],
      providers: [provideHttpClient(), provideHttpClientTesting(), EditorStore],
    }).compileComponents();

    fixture = TestBed.createComponent(TextOverlay);
    fixture.componentRef.setInput('runs', [run]);
    fixture.componentRef.setInput('mapper', (x: number, y: number) => ({ x, y }));
    fixture.componentRef.setInput('selectedId', null);
    fixture.componentRef.setInput('editingId', null);
    fixture.detectChanges();
  });

  it('does not highlight runs until the user selects one', async () => {
    await fixture.whenStable();

    const hit = fixture.nativeElement.querySelector('.text-overlay__hit') as HTMLButtonElement;
    expect(hit).toBeTruthy();
    expect(hit.style.left).toBe('6px');
    expect(hit.style.top).toBe('16px');
    expect(hit.style.width).toBe('48px');
    expect(hit.style.height).toBe('20px');
    expect(hit.classList.contains('text-overlay__hit--selected')).toBe(false);
    expect(fixture.nativeElement.querySelector('.text-format-bar')).toBeNull();
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('shows edit and delete after a run is selected', async () => {
    fixture.componentRef.setInput('selectedId', '1-0');
    fixture.detectChanges();
    await fixture.whenStable();

    const hit = fixture.nativeElement.querySelector('.text-overlay__hit') as HTMLButtonElement;
    expect(hit.classList.contains('text-overlay__hit--selected')).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Edit text"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Delete text"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('emits select on click and edit on the edit action', async () => {
    const selected: string[] = [];
    const edited: string[] = [];
    fixture.componentInstance.select.subscribe((id) => selected.push(id));
    fixture.componentInstance.edit.subscribe((id) => edited.push(id));
    await fixture.whenStable();

    const hit = fixture.nativeElement.querySelector('.text-overlay__hit') as HTMLButtonElement;
    hit.click();
    expect(selected).toEqual(['1-0']);

    fixture.componentRef.setInput('selectedId', '1-0');
    fixture.detectChanges();
    await fixture.whenStable();

    const edit = fixture.nativeElement.querySelector('[aria-label="Edit text"]') as HTMLButtonElement;
    edit.click();
    expect(edited).toEqual(['1-0']);
  });
});
