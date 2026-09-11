import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody } from './models';

export function messageFromHttp(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | string | null;
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
    if (error.status === 0) {
      return 'Cannot reach the PDFForge API.';
    }
    return error.statusText || 'Request failed';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Request failed';
}
