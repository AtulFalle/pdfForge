import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MutationResponse } from '../../core/api/models';
import { EditorStore } from './editor-store';

function mutation(text = 'Hello'): MutationResponse {
  return {
    sessionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    revision: 1,
    fileUrl: '/api/sessions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file',
    analysis: {
      revision: 1,
      pages: [{ number: 1, width: 612, height: 792, rotation: 0 }],
      runs: [
        {
          id: '1-0',
          page: 1,
          text,
          bbox: { x: 72, y: 720, width: 80, height: 24 },
          style: { font_name: 'Helvetica', size: 24, color: '#000000' },
          transform: [1, 0, 0, 1, 72, 720],
          source_operators: ['Tj'],
          font_fallback: false,
        },
      ],
    },
  };
}

describe('EditorStore', () => {
  let store: EditorStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EditorStore],
    });
    store = TestBed.inject(EditorStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('opens a PDF and stores analysis without keeping extra copies in signals', async () => {
    const file = new File(['%PDF-1.4'], 'hello.pdf', { type: 'application/pdf' });
    const opened = store.openDocument(file);
    await Promise.resolve();

    const create = http.expectOne('/api/sessions');
    create.flush(mutation(), { status: 201, statusText: 'Created' });
    await Promise.resolve();

    const pdf = http.expectOne(
      (request) => request.url === '/api/sessions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/file',
    );
    pdf.flush(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer);
    await opened;

    expect(store.sessionId()).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(store.selectedRun()).toBeNull();
    expect(store.runs()[0].text).toBe('Hello');
    expect(store.pdfData()?.byteLength).toBe(4);
  });

  it('sends a replace using the current revision', async () => {
    const file = new File(['%PDF-1.4'], 'hello.pdf', { type: 'application/pdf' });
    const opened = store.openDocument(file);
    await Promise.resolve();
    http.expectOne('/api/sessions').flush(mutation(), { status: 201, statusText: 'Created' });
    await Promise.resolve();
    http
      .expectOne((request) => request.url.endsWith('/file'))
      .flush(new Uint8Array([0x25]).buffer);
    await opened;

    store.selectRun('1-0');
    const replaced = store.replaceSelected('Hello API');
    await Promise.resolve();

    const request = http.expectOne('/api/sessions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/runs/1-0');
    expect(request.request.headers.get('X-Document-Revision')).toBe('1');
    request.flush({ ...mutation('Hello API'), revision: 2 });
    await Promise.resolve();
    http.expectOne((item) => item.url.endsWith('/file')).flush(new Uint8Array([0x25]).buffer);
    await replaced;

    expect(store.revision()).toBe(2);
    expect(store.runs()[0].text).toBe('Hello API');
    expect(store.canUndo()).toBe(true);
  });

  it('duplicates a page through the session API', async () => {
    const file = new File(['%PDF-1.4'], 'hello.pdf', { type: 'application/pdf' });
    const opened = store.openDocument(file);
    await Promise.resolve();
    http.expectOne('/api/sessions').flush(mutation(), { status: 201, statusText: 'Created' });
    await Promise.resolve();
    http
      .expectOne((request) => request.url.endsWith('/file'))
      .flush(new Uint8Array([0x25]).buffer);
    await opened;

    const duplicated = store.duplicatePage(1);
    await Promise.resolve();

    const request = http.expectOne(
      '/api/sessions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/pages/duplicate',
    );
    expect(request.request.body).toEqual({ page: 1 });
    expect(request.request.headers.get('X-Document-Revision')).toBe('1');
    request.flush({
      ...mutation(),
      revision: 2,
      analysis: {
        revision: 2,
        pages: [
          { number: 1, width: 612, height: 792, rotation: 0 },
          { number: 2, width: 612, height: 792, rotation: 0 },
        ],
        runs: mutation().analysis.runs,
      },
    });
    await Promise.resolve();
    http.expectOne((item) => item.url.endsWith('/file')).flush(new Uint8Array([0x25]).buffer);
    await duplicated;

    expect(store.revision()).toBe(2);
    expect(store.pageCount()).toBe(2);
    expect(store.selectedPage()).toBe(2);
  });

  it('selects a run without entering edit until beginEditRun', async () => {
    const file = new File(['%PDF-1.4'], 'hello.pdf', { type: 'application/pdf' });
    const opened = store.openDocument(file);
    await Promise.resolve();
    http.expectOne('/api/sessions').flush(mutation(), { status: 201, statusText: 'Created' });
    await Promise.resolve();
    http
      .expectOne((request) => request.url.endsWith('/file'))
      .flush(new Uint8Array([0x25]).buffer);
    await opened;

    expect(store.selectedRunId()).toBeNull();
    expect(store.editingRunId()).toBeNull();

    store.selectRun('1-0');
    expect(store.selectedRunId()).toBe('1-0');
    expect(store.editingRunId()).toBeNull();

    store.beginEditRun('1-0');
    expect(store.editingRunId()).toBe('1-0');

    store.cancelEditRun();
    expect(store.editingRunId()).toBeNull();
    expect(store.selectedRunId()).toBe('1-0');
  });
});
