import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AddTextRequest,
  MutationResponse,
  PageRotation,
  TextRun,
} from './models';

const REVISION_HEADER = 'X-Document-Revision';

@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly http = inject(HttpClient);

  create(file: File): Observable<MutationResponse> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<MutationResponse>('/api/sessions', body);
  }

  get(id: string): Observable<MutationResponse> {
    return this.http.get<MutationResponse>(`/api/sessions/${id}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/sessions/${id}`);
  }

  file(id: string, revision: number): Observable<ArrayBuffer> {
    return this.http.get(`/api/sessions/${id}/file`, {
      responseType: 'arraybuffer',
      params: { rev: String(revision) },
    });
  }

  export(id: string): Observable<Blob> {
    return this.http.get(`/api/sessions/${id}/export`, {
      responseType: 'blob',
    });
  }

  search(id: string, q: string): Observable<TextRun[]> {
    return this.http.get<TextRun[]>(`/api/sessions/${id}/search`, {
      params: { q },
    });
  }

  replace(
    id: string,
    runId: string,
    text: string,
    revision: number,
  ): Observable<MutationResponse> {
    return this.http.put<MutationResponse>(
      `/api/sessions/${id}/runs/${encodeURIComponent(runId)}`,
      { text },
      { headers: this.revisionHeaders(revision) },
    );
  }

  deleteRun(id: string, runId: string, revision: number): Observable<MutationResponse> {
    return this.http.delete<MutationResponse>(
      `/api/sessions/${id}/runs/${encodeURIComponent(runId)}`,
      { headers: this.revisionHeaders(revision) },
    );
  }

  add(id: string, body: AddTextRequest, revision: number): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(`/api/sessions/${id}/runs`, body, {
      headers: this.revisionHeaders(revision),
    });
  }

  reorder(id: string, order: number[], revision: number): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(
      `/api/sessions/${id}/pages/reorder`,
      { order },
      { headers: this.revisionHeaders(revision) },
    );
  }

  rotate(
    id: string,
    rotations: PageRotation[],
    revision: number,
  ): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(
      `/api/sessions/${id}/pages/rotate`,
      { rotations },
      { headers: this.revisionHeaders(revision) },
    );
  }

  deletePages(id: string, pages: number[], revision: number): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(
      `/api/sessions/${id}/pages/delete`,
      { pages },
      { headers: this.revisionHeaders(revision) },
    );
  }

  merge(id: string, file: File, revision: number): Observable<MutationResponse> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<MutationResponse>(`/api/sessions/${id}/merge`, body, {
      headers: this.revisionHeaders(revision),
    });
  }

  split(id: string, pages: number[]): Observable<Blob> {
    return this.http.post(`/api/sessions/${id}/split`, { pages }, { responseType: 'blob' });
  }

  undo(id: string, revision: number): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(
      `/api/sessions/${id}/undo`,
      {},
      { headers: this.revisionHeaders(revision) },
    );
  }

  redo(id: string, revision: number): Observable<MutationResponse> {
    return this.http.post<MutationResponse>(
      `/api/sessions/${id}/redo`,
      {},
      { headers: this.revisionHeaders(revision) },
    );
  }

  private revisionHeaders(revision: number): HttpHeaders {
    return new HttpHeaders({ [REVISION_HEADER]: String(revision) });
  }
}
