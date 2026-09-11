import { DestroyRef, inject, Injectable } from '@angular/core';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import type { PageViewport } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export interface RenderedPage {
  viewport: PageViewport;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class PdfRenderer {
  private document: PDFDocumentProxy | null = null;
  private epoch = -1;
  private opening: Promise<PDFDocumentProxy> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      void this.document?.cleanup();
      this.document = null;
    });
  }

  async documentFor(epoch: number, bytes: Uint8Array): Promise<PDFDocumentProxy> {
    if (this.document && this.epoch === epoch) {
      return this.document;
    }

    if (this.opening && this.epoch === epoch) {
      return this.opening;
    }

    this.epoch = epoch;
    const previous = this.document;
    this.document = null;
    void previous?.cleanup();

    this.opening = getDocument({ data: bytes.slice() }).promise.then((doc) => {
      this.document = doc;
      this.opening = null;
      return doc;
    });

    return this.opening;
  }

  async renderPage(
    epoch: number,
    bytes: Uint8Array,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    scale: number,
  ): Promise<RenderedPage> {
    const doc = await this.documentFor(epoch, bytes);
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const task = page.render({ canvas, viewport });
    await task.promise;

    return {
      viewport,
      width: viewport.width,
      height: viewport.height,
    };
  }
}
