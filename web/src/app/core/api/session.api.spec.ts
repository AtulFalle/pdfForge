import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MutationResponse } from './models';
import { SessionApi } from './session.api';

function mutation(): MutationResponse {
  return {
    sessionId: '11111111-1111-1111-1111-111111111111',
    revision: 1,
    fileUrl: '/api/sessions/11111111-1111-1111-1111-111111111111/file',
    analysis: {
      revision: 1,
      pages: [{ number: 1, width: 612, height: 792, rotation: 0 }],
      runs: [
        {
          id: '1-0',
          page: 1,
          text: 'Hello',
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

describe('SessionApi', () => {
  let api: SessionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SessionApi],
    });
    api = TestBed.inject(SessionApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('creates a session from a PDF upload', () => {
    const file = new File(['%PDF'], 'hello.pdf', { type: 'application/pdf' });
    let result: MutationResponse | undefined;
    api.create(file).subscribe((value) => {
      result = value;
    });

    const request = http.expectOne('/api/sessions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    request.flush(mutation(), { status: 201, statusText: 'Created' });

    expect(result?.sessionId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('sends the document revision when replacing text', () => {
    api.replace('abc', '1-0', 'Hi', 3).subscribe();

    const request = http.expectOne('/api/sessions/abc/runs/1-0');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ text: 'Hi' });
    expect(request.request.headers.get('X-Document-Revision')).toBe('3');
    request.flush({ ...mutation(), revision: 4 });
  });
});
