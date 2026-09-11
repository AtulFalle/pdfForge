import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElDialog, ElDialogClose } from '../../ui/dialog/dialog';
import { ElFileUpload } from '../../ui/file-upload/file-upload';
import { ElLabel } from '../../ui/label/label';
import { ElProgress } from '../../ui/progress/progress';
import { ElStack } from '../../ui/stack/stack';
import { PagePanel } from '../pages/page-panel';
import { EditorStore } from './editor-store';
import { EditorToolbar } from './editor-toolbar';
import { EditorTools } from './editor-tools';
import { PdfViewer } from './pdf-viewer';

@Component({
  selector: 'app-editor-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElButton,
    ElDialog,
    ElDialogClose,
    ElFileUpload,
    ElLabel,
    ElProgress,
    ElStack,
    EditorToolbar,
    EditorTools,
    PagePanel,
    PdfViewer,
  ],
  styleUrl: './editor-shell.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <app-editor-toolbar (merge)="mergeOpen.set(true)" />

    @if (store.busy()) {
      <el-progress indeterminate />
    }

    <div class="editor-shell__body">
      <aside class="editor-shell__pages">
        <app-page-panel
          (splitPage)="requestSplit($event)"
          (deletePage)="requestDeletePage($event)"
        />
      </aside>
      <main class="editor-shell__workspace">
        <app-pdf-viewer (deleteRun)="deleteRunOpen.set(true)" />
      </main>
    </div>

    <app-editor-tools />

    <el-dialog
      [open]="editOpen()"
      (openChange)="onEditOpenChange($event)"
      title="Edit text"
    >
      <div elDialogContent>
        <el-stack gap="2">
          <el-label htmlFor="edit-text-field" required>Text</el-label>
          <textarea
            id="edit-text-field"
            class="editor-shell__edit-field"
            rows="5"
            [value]="editDraft()"
            aria-label="Edited text"
            autofocus
            (input)="onEditDraft($event)"
            (keydown)="onEditKey($event)"
          ></textarea>
        </el-stack>
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button
          variant="primary"
          [disabled]="!canSaveEdit()"
          (click)="confirmEdit()"
        >
          Save
        </el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="deleteRunOpen" title="Delete text" size="sm">
      <div elDialogContent>Remove this text from the PDF content stream?</div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" (click)="confirmDeleteRun()">Delete</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="deletePagesOpen" title="Delete page" size="sm">
      <div elDialogContent>
        Delete page {{ store.actionPage() }}? This edits the PDF, not just the view.
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" (click)="confirmDeletePage()">Delete</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="splitOpen" title="Split PDF" size="sm">
      <div elDialogContent>
        Download a new PDF containing page {{ store.actionPage() }}.
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" (click)="confirmSplit()">Download split PDF</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="mergeOpen" title="Merge PDF" size="sm">
      <div elDialogContent>
        <el-file-upload
          [(files)]="mergeFiles"
          accept="application/pdf,.pdf"
          [maxSize]="maxSize"
          dropTitle="Drop a PDF to merge"
          browseLabel="Browse PDF"
        >
          Pages from this file are appended to the current document.
        </el-file-upload>
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" [disabled]="mergeFiles().length === 0" (click)="confirmMerge()">
          Merge
        </el-button>
      </div>
    </el-dialog>
  `,
})
export class EditorShell {
  protected readonly store = inject(EditorStore);
  protected readonly editOpen = computed(() => this.store.editingRunId() !== null);
  protected readonly editDraft = linkedSignal(() => {
    const id = this.store.editingRunId();
    const run = this.store.selectedRun();
    if (!id || run?.id !== id) {
      return '';
    }
    return run.text;
  });
  protected readonly canSaveEdit = computed(
    () => this.editDraft().trim().length > 0 && !this.store.busy(),
  );
  protected readonly deleteRunOpen = signal(false);
  protected readonly deletePagesOpen = signal(false);
  protected readonly splitOpen = signal(false);
  protected readonly mergeOpen = signal(false);
  protected readonly mergeFiles = signal<File[]>([]);
  protected readonly maxSize = 50 * 1024 * 1024;

  protected onEditOpenChange(open: boolean): void {
    if (!open) {
      this.store.cancelEditRun();
    }
  }

  protected onEditDraft(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.editDraft.set(target.value);
    }
  }

  protected onEditKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void this.confirmEdit();
    }
  }

  protected async confirmEdit(): Promise<void> {
    if (!this.canSaveEdit()) {
      return;
    }
    const text = this.editDraft();
    const current = this.store.selectedRun()?.text ?? '';
    if (text === current) {
      this.store.cancelEditRun();
      return;
    }
    await this.store.replaceSelected(text);
  }

  protected requestSplit(page: number): void {
    this.store.actionPage.set(page);
    this.splitOpen.set(true);
  }

  protected requestDeletePage(page: number): void {
    this.store.actionPage.set(page);
    this.deletePagesOpen.set(true);
  }

  protected async confirmDeleteRun(): Promise<void> {
    this.deleteRunOpen.set(false);
    await this.store.deleteSelectedRun();
  }

  protected async confirmDeletePage(): Promise<void> {
    const page = this.store.actionPage();
    this.deletePagesOpen.set(false);
    if (page != null) {
      await this.store.deletePage(page);
    }
    this.store.actionPage.set(null);
  }

  protected async confirmSplit(): Promise<void> {
    const page = this.store.actionPage();
    this.splitOpen.set(false);
    if (page != null) {
      await this.store.splitPage(page);
    }
    this.store.actionPage.set(null);
  }

  protected async confirmMerge(): Promise<void> {
    const file = this.mergeFiles()[0];
    if (!file) {
      return;
    }
    this.mergeOpen.set(false);
    this.mergeFiles.set([]);
    await this.store.merge(file);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.store.searchOpen.set(true);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      if (typing && this.store.editingRunId()) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        void this.store.redo();
      } else {
        void this.store.undo();
      }
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      void this.store.redo();
      return;
    }

    if (event.key === 'Escape') {
      if (this.store.pendingAdd()) {
        event.preventDefault();
        this.store.cancelPendingAdd();
        return;
      }
      if (this.store.editingRunId()) {
        event.preventDefault();
        this.store.cancelEditRun();
        return;
      }
      if (!typing) {
        this.store.selectRun(null);
        this.store.setTool('select');
        this.store.searchOpen.set(false);
      }
      return;
    }

    if (typing) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.store.selectedRun()) {
        event.preventDefault();
        this.deleteRunOpen.set(true);
      }
    }
    if (event.key === 'Enter' && this.store.selectedRun() && !this.store.editingRunId()) {
      event.preventDefault();
      this.store.beginEditRun(this.store.selectedRun()!.id);
    }
  }
}
