import { httpResource } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ElToastService } from '../../ui/toast/toast';
import { messageFromHttp } from '../../core/api/api-error';
import type {
  AddTextRequest,
  EditorTool,
  MutationResponse,
  PendingAdd,
  TextRun,
  ViewportSize,
} from '../../core/api/models';
import { SessionApi } from '../../core/api/session.api';
import { downloadBlob } from '../../core/download';

const SEARCH_DELAY_MS = 300;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

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
  readonly undoDepth = signal(0);
  readonly redoDepth = signal(0);
  readonly pendingAdd = signal<PendingAdd | null>(null);
  readonly editingRunId = signal<string | null>(null);
  readonly actionPage = signal<number | null>(null);
  readonly viewportSize = signal<ViewportSize>({ width: 0, height: 0 });
  readonly searchOpen = signal(false);

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

  selectPage(page: number): void {
    this.selectedPage.set(page);
    const run = this.selectedRun();
    if (run && run.page !== page) {
      this.selectedRunId.set(null);
      this.editingRunId.set(null);
    }
    if (this.pendingAdd() && this.pendingAdd()!.page !== page) {
      this.pendingAdd.set(null);
    }
  }

  selectRun(runId: string | null): void {
    this.selectedRunId.set(runId);
    this.editingRunId.set(null);
    this.pendingAdd.set(null);
    const run = this.runs().find((item) => item.id === runId);
    if (run) {
      this.selectedPage.set(run.page);
      this.tool.set('select');
    }
  }

  beginEditRun(runId: string): void {
    this.selectedRunId.set(runId);
    this.editingRunId.set(runId);
    this.pendingAdd.set(null);
    this.tool.set('select');
  }

  cancelEditRun(): void {
    this.editingRunId.set(null);
  }

  setTool(tool: EditorTool): void {
    const next = this.tool() === tool && tool !== 'select' ? 'select' : tool;
    this.tool.set(next);
    if (next !== 'add-text') {
      this.pendingAdd.set(null);
    }
    if (next === 'add-text') {
      this.selectedRunId.set(null);
      this.editingRunId.set(null);
    }
  }

  setViewportSize(size: ViewportSize): void {
    this.viewportSize.set(size);
  }

  bumpZoom(delta: number): void {
    this.zoom.set(clampZoom(this.zoom() + delta));
  }

  fitZoom(): void {
    const page = this.currentPage();
    const viewport = this.viewportSize();
    if (!page || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }
    const padding = 48;
    const scale = Math.min(
      (viewport.width - padding) / page.width,
      (viewport.height - padding) / page.height,
    );
    this.zoom.set(clampZoom(Math.round((scale * 100) / ZOOM_STEP) * ZOOM_STEP));
  }

  startPendingAdd(page: number, x: number, y: number): void {
    this.pendingAdd.set({
      page,
      x,
      y,
      text: '',
      size: 14,
      color: '#000000',
    });
    this.selectedRunId.set(null);
    this.editingRunId.set(null);
  }

  updatePendingAdd(patch: Partial<PendingAdd>): void {
    const current = this.pendingAdd();
    if (!current) {
      return;
    }
    this.pendingAdd.set({ ...current, ...patch });
  }

  cancelPendingAdd(): void {
    this.pendingAdd.set(null);
    this.tool.set('select');
  }

  async commitPendingAdd(): Promise<void> {
    const pending = this.pendingAdd();
    if (!pending) {
      return;
    }
    const text = pending.text.trim();
    if (!text) {
      this.cancelPendingAdd();
      return;
    }
    this.pendingAdd.set(null);
    await this.addText({
      page: pending.page,
      text,
      x: pending.x,
      y: pending.y,
      size: pending.size,
      color: pending.color,
    });
  }

  async openDocument(file: File): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const response = await firstValueFrom(this.api.create(file));
      this.fileName.set(file.name || 'document.pdf');
      this.selectedPage.set(response.analysis.pages[0]?.number ?? 1);
      this.selectedRunId.set(null);
      this.editingRunId.set(null);
      this.pendingAdd.set(null);
      this.undoDepth.set(0);
      this.redoDepth.set(0);
      this.tool.set('select');
      this.searchQuery.set('');
      this.searchOpen.set(false);
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
    this.editingRunId.set(null);
    this.pendingAdd.set(null);
    this.error.set(null);
    this.searchQuery.set('');
    this.searchOpen.set(false);
  }

  async replaceSelected(text: string): Promise<void> {
    const run = this.selectedRun();
    if (!run) {
      return;
    }
    this.editingRunId.set(null);
    await this.mutate((id, revision) => this.api.replace(id, run.id, text, revision));
  }

  async deleteSelectedRun(): Promise<void> {
    const run = this.selectedRun();
    if (!run) {
      return;
    }
    await this.mutate((id, revision) => this.api.deleteRun(id, run.id, revision));
    this.selectedRunId.set(null);
    this.editingRunId.set(null);
  }

  async addText(request: AddTextRequest): Promise<void> {
    await this.mutate((id, revision) => this.api.add(id, request, revision));
    this.tool.set('select');
  }

  async rotatePage(page: number, delta = 90): Promise<void> {
    const info = this.pages().find((item) => item.number === page);
    if (!info) {
      return;
    }
    const degrees = ((info.rotation + delta) % 360 + 360) % 360;
    await this.mutate((id, revision) =>
      this.api.rotate(id, [{ page, degrees }], revision),
    );
  }

  async duplicatePage(page: number): Promise<void> {
    await this.mutate((id, revision) => this.api.duplicate(id, page, revision));
    this.selectedPage.set(page + 1);
  }

  async movePage(page: number, offset: number): Promise<void> {
    const pages = this.pages();
    const index = pages.findIndex((item) => item.number === page);
    const next = index + offset;
    if (index < 0 || next < 0 || next >= pages.length) {
      return;
    }
    const order = pages.map((item) => item.number);
    const [moved] = order.splice(index, 1);
    order.splice(next, 0, moved);
    await this.mutate((id, revision) => this.api.reorder(id, order, revision));
    this.selectedPage.set(next + 1);
  }

  async deletePage(page: number): Promise<void> {
    if (this.pageCount() <= 1) {
      this.toast.show('Keep at least one page.', { color: 'warning' });
      return;
    }
    await this.mutate((id, revision) => this.api.deletePages(id, [page], revision));
  }

  async merge(file: File): Promise<void> {
    await this.mutate((id, revision) => this.api.merge(id, file, revision));
  }

  async splitPage(page: number): Promise<void> {
    const id = this.requireSession();
    if (!id) {
      return;
    }
    this.busy.set(true);
    try {
      const blob = await firstValueFrom(this.api.split(id, [page]));
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

  pageIndex(page: number): number {
    return this.pages().findIndex((item) => item.number === page);
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
      this.editingRunId.set(null);
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

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP };
