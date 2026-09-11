import { httpResource } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ElToastService } from '../../ui/toast/toast';
import { messageFromHttp } from '../../core/api/api-error';
import type { AddTextRequest, EditorTool, MutationResponse, TextRun } from '../../core/api/models';
import { SessionApi } from '../../core/api/session.api';
import { downloadBlob } from '../../core/download';

const SEARCH_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class EditorStore {
  private readonly api = inject(SessionApi);
  private readonly toast = inject(ElToastService);
  private pdfBytes: Uint8Array | null = null;

  readonly sessionId = signal<string | null>(null);
  readonly revision = signal(0);
  readonly analysis = signal<MutationResponse['analysis'] | null>(null);
  readonly fileEpoch = signal(0);
  readonly fileName = signal('document.pdf');
  readonly selectedPage = signal(1);
  readonly selectedRunId = signal<string | null>(null);
  readonly zoom = signal(100);
  readonly tool = signal<EditorTool>('select');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');
  readonly debouncedQuery = signal('');
  readonly selectedPages = signal<ReadonlySet<number>>(new Set());
  readonly undoDepth = signal(0);
  readonly redoDepth = signal(0);

  readonly pages = computed(() => this.analysis()?.pages ?? []);
  readonly runs = computed(() => this.analysis()?.runs ?? []);
  readonly pageCount = computed(() => this.pages().length);
  readonly currentPage = computed(
    () => this.pages().find((page) => page.number === this.selectedPage()) ?? null,
  );
  readonly pageRuns = computed(() =>
    this.runs().filter((run) => run.page === this.selectedPage()),
  );
  readonly selectedRun = computed(
    () => this.runs().find((run) => run.id === this.selectedRunId()) ?? null,
  );
  readonly hasSession = computed(() => this.sessionId() !== null);
  readonly canUndo = computed(() => this.undoDepth() > 0);
  readonly canRedo = computed(() => this.redoDepth() > 0);

  readonly searchHits = httpResource<TextRun[]>(
    () => {
      const sessionId = this.sessionId();
      const q = this.debouncedQuery().trim();
      if (!sessionId || q.length === 0) {
        return undefined;
      }
      return {
        url: `/api/sessions/${sessionId}/search`,
        params: { q },
      };
    },
    { defaultValue: [] },
  );

  constructor() {
    effect((onCleanup) => {
      const query = this.searchQuery();
      const timer = setTimeout(() => this.debouncedQuery.set(query), SEARCH_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });

    effect(() => {
      const pages = this.pages();
      if (pages.length === 0) {
        return;
      }
      const current = untracked(() => this.selectedPage());
      if (!pages.some((page) => page.number === current)) {
        this.selectedPage.set(pages[0].number);
      }
    });
  }

  pdfData(): Uint8Array | null {
    return this.pdfBytes;
  }

  isPageChecked(page: number): boolean {
    return this.selectedPages().has(page);
  }

  setPageChecked(page: number, checked: boolean): void {
    const next = new Set(this.selectedPages());
    if (checked) {
      next.add(page);
    } else {
      next.delete(page);
    }
    this.selectedPages.set(next);
  }

  selectPage(page: number): void {
    this.selectedPage.set(page);
    const run = this.selectedRun();
    if (run && run.page !== page) {
      this.selectedRunId.set(null);
    }
  }

  selectRun(runId: string | null): void {
    this.selectedRunId.set(runId);
    const run = this.runs().find((item) => item.id === runId);
    if (run) {
      this.selectedPage.set(run.page);
      this.tool.set('select');
    }
  }

  setTool(tool: EditorTool): void {
    this.tool.set(this.tool() === tool && tool !== 'select' ? 'select' : tool);
  }

  async openDocument(file: File): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const response = await firstValueFrom(this.api.create(file));
      this.fileName.set(file.name || 'document.pdf');
      this.selectedPage.set(response.analysis.pages[0]?.number ?? 1);
      this.selectedRunId.set(null);
      this.selectedPages.set(new Set());
      this.undoDepth.set(0);
      this.redoDepth.set(0);
      this.tool.set('select');
      this.searchQuery.set('');
      await this.applyMutation(response, { countUndo: false });
      this.toast.show('Document opened.', { color: 'success' });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  async closeDocument(): Promise<void> {
    const id = this.sessionId();
    if (id) {
      try {
        await firstValueFrom(this.api.delete(id));
      } catch {
        // Session cleanup is best-effort.
      }
    }
    this.pdfBytes = null;
    this.sessionId.set(null);
    this.analysis.set(null);
    this.revision.set(0);
    this.fileEpoch.set(0);
    this.selectedRunId.set(null);
    this.selectedPages.set(new Set());
    this.error.set(null);
    this.searchQuery.set('');
  }

  async replaceSelected(text: string): Promise<void> {
    const run = this.selectedRun();
    if (!run) {
      return;
    }
    await this.mutate((id, revision) => this.api.replace(id, run.id, text, revision));
  }

  async deleteSelectedRun(): Promise<void> {
    const run = this.selectedRun();
    if (!run) {
      return;
    }
    await this.mutate((id, revision) => this.api.deleteRun(id, run.id, revision));
    this.selectedRunId.set(null);
  }

  async addText(request: AddTextRequest): Promise<void> {
    await this.mutate((id, revision) => this.api.add(id, request, revision));
    this.tool.set('select');
  }

  async rotateSelected(delta = 90): Promise<void> {
    const page = this.currentPage();
    if (!page) {
      return;
    }
    const degrees = ((page.rotation + delta) % 360 + 360) % 360;
    await this.mutate((id, revision) =>
      this.api.rotate(id, [{ page: page.number, degrees }], revision),
    );
  }

  async movePage(offset: number): Promise<void> {
    const pages = this.pages();
    const index = pages.findIndex((page) => page.number === this.selectedPage());
    const next = index + offset;
    if (index < 0 || next < 0 || next >= pages.length) {
      return;
    }
    const order = pages.map((page) => page.number);
    const [moved] = order.splice(index, 1);
    order.splice(next, 0, moved);
    await this.mutate((id, revision) => this.api.reorder(id, order, revision));
  }

  async deleteCheckedPages(): Promise<void> {
    const pages = this.pagesToActOn();
    if (pages.length === 0) {
      return;
    }
    if (pages.length >= this.pageCount()) {
      this.toast.show('Keep at least one page.', { color: 'warning' });
      return;
    }
    await this.mutate((id, revision) => this.api.deletePages(id, pages, revision));
    this.selectedPages.set(new Set());
  }

  async merge(file: File): Promise<void> {
    await this.mutate((id, revision) => this.api.merge(id, file, revision));
  }

  async splitChecked(): Promise<void> {
    const id = this.requireSession();
    const pages = this.pagesToActOn();
    if (!id || pages.length === 0) {
      this.toast.show('Select one or more pages to split.', { color: 'warning' });
      return;
    }
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(this.api.split(id, pages));
      downloadBlob(blob, splitName(this.fileName()));
      this.toast.show('Split PDF downloaded.', { color: 'success' });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  async undo(): Promise<void> {
    await this.mutate((id, revision) => this.api.undo(id, revision), { undo: true });
  }

  async redo(): Promise<void> {
    await this.mutate((id, revision) => this.api.redo(id, revision), { redo: true });
  }

  async exportDocument(): Promise<void> {
    const id = this.requireSession();
    if (!id) {
      return;
    }
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(this.api.export(id));
      downloadBlob(blob, exportName(this.fileName()));
      this.toast.show('Exported PDF.', { color: 'success' });
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  pagesToActOn(): number[] {
    const checked = [...this.selectedPages()];
    if (checked.length > 0) {
      return checked.sort((a, b) => a - b);
    }
    return this.currentPage() ? [this.currentPage()!.number] : [];
  }

  private requireSession(): string | null {
    const id = this.sessionId();
    if (!id) {
      this.toast.show('Open a PDF first.', { color: 'warning' });
    }
    return id;
  }

  private async mutate(
    action: (id: string, revision: number) => ReturnType<SessionApi['replace']>,
    options?: { undo?: boolean; redo?: boolean; countUndo?: boolean },
  ): Promise<void> {
    const id = this.requireSession();
    if (!id) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(action(id, this.revision()));
      await this.applyMutation(response, options);
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy.set(false);
    }
  }

  private async applyMutation(
    response: MutationResponse,
    options?: { undo?: boolean; redo?: boolean; countUndo?: boolean },
  ): Promise<void> {
    this.sessionId.set(response.sessionId);
    this.revision.set(response.revision);
    this.analysis.set(response.analysis);
    if (response.fontFallback) {
      this.toast.show('Replacement used a fallback font.', { color: 'warning' });
    }
    const runId = this.selectedRunId();
    if (runId && !response.analysis.runs.some((run) => run.id === runId)) {
      this.selectedRunId.set(null);
    }
    if (options?.undo) {
      this.undoDepth.update((value) => Math.max(0, value - 1));
      this.redoDepth.update((value) => value + 1);
    } else if (options?.redo) {
      this.redoDepth.update((value) => Math.max(0, value - 1));
      this.undoDepth.update((value) => value + 1);
    } else if (options?.countUndo !== false) {
      this.undoDepth.update((value) => value + 1);
      this.redoDepth.set(0);
    }
    const bytes = await firstValueFrom(this.api.file(response.sessionId, response.revision));
    this.pdfBytes = new Uint8Array(bytes);
    this.fileEpoch.update((value) => value + 1);
  }

  private fail(error: unknown): void {
    const message = messageFromHttp(error);
    this.error.set(message);
    this.toast.show(message, { color: 'error', title: 'Could not update PDF' });
  }
}

function exportName(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name.replace(/\.pdf$/i, '-export.pdf') : `${name}.pdf`;
}

function splitName(name: string): string {
  return name.toLowerCase().endsWith('.pdf') ? name.replace(/\.pdf$/i, '-split.pdf') : `${name}-split.pdf`;
}
