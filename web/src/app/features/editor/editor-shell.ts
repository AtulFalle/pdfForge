import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { Point } from '../../core/pdf/bbox';
import { ElAlert } from '../../ui/alert/alert';
import { ElButton } from '../../ui/button/button';
import { ElDialog, ElDialogClose } from '../../ui/dialog/dialog';
import { ElFileUpload } from '../../ui/file-upload/file-upload';
import { ElInput } from '../../ui/input/input';
import { ElLabel } from '../../ui/label/label';
import { ElProgress } from '../../ui/progress/progress';
import {
  ElResizable,
  ElResizableHandle,
  ElResizablePanel,
} from '../../ui/resizable/resizable';
import { ElStack } from '../../ui/stack/stack';
import { PagePanel } from '../pages/page-panel';
import { EditorStore } from './editor-store';
import { EditorToolbar } from './editor-toolbar';
import { PdfViewer } from './pdf-viewer';
import { TextProperties } from './text-properties';

@Component({
  selector: 'app-editor-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElAlert,
    ElButton,
    ElDialog,
    ElDialogClose,
    ElFileUpload,
    ElInput,
    ElLabel,
    ElProgress,
    ElResizable,
    ElResizableHandle,
    ElResizablePanel,
    ElStack,
    EditorToolbar,
    PagePanel,
    PdfViewer,
    TextProperties,
  ],
  styleUrl: './editor-shell.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <app-editor-toolbar
      (split)="splitOpen.set(true)"
      (merge)="mergeOpen.set(true)"
      (deletePages)="deletePagesOpen.set(true)"
    />

    @if (store.error(); as message) {
      <el-alert color="error" title="PDF update failed" dismissible (dismissed)="store.error.set(null)">
        {{ message }}
      </el-alert>
    }
    @if (store.busy()) {
      <el-progress indeterminate />
    }

    <div class="editor-shell__body">
      <el-resizable class="editor-shell__panes">
        <el-resizable-panel [defaultSize]="18" [min]="14">
          <app-page-panel />
        </el-resizable-panel>
        <el-resizable-handle ariaLabel="Resize page list" />
        <el-resizable-panel [min]="40">
          <app-pdf-viewer (addAt)="onAddAt($event)" />
        </el-resizable-panel>
        <el-resizable-handle ariaLabel="Resize properties" />
        <el-resizable-panel [defaultSize]="24" [min]="18">
          <app-text-properties (deleteRun)="deleteRunOpen.set(true)" />
        </el-resizable-panel>
      </el-resizable>
    </div>

    <el-dialog [(open)]="addOpen" title="Add text" size="sm">
      <div elDialogContent>
        <el-stack gap="3">
          <el-label htmlFor="add-text" required>Text</el-label>
          <el-input inputId="add-text" [(value)]="addText" ariaLabel="New text" />
          <el-label htmlFor="add-size">Size</el-label>
          <el-input inputId="add-size" type="number" [(value)]="addSize" ariaLabel="Font size" />
          <el-label htmlFor="add-color">Color</el-label>
          <el-input inputId="add-color" [(value)]="addColor" placeholder="#000000" ariaLabel="Text color" />
        </el-stack>
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" [disabled]="!addText().trim()" (click)="confirmAdd()">Add</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="deleteRunOpen" title="Delete text" size="sm">
      <div elDialogContent>Remove this text from the PDF content stream?</div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" (click)="confirmDeleteRun()">Delete</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="deletePagesOpen" title="Delete pages" size="sm">
      <div elDialogContent>
        Delete {{ store.pagesToActOn().length }} page(s)? This edits the PDF, not just the view.
      </div>
      <div elDialogFooter>
        <el-button elDialogClose variant="ghost">Cancel</el-button>
        <el-button variant="primary" (click)="confirmDeletePages()">Delete</el-button>
      </div>
    </el-dialog>

    <el-dialog [(open)]="splitOpen" title="Split PDF" size="sm">
      <div elDialogContent>
        Download a new PDF containing {{ store.pagesToActOn().length }} selected page(s).
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
  protected readonly addOpen = signal(false);
  protected readonly deleteRunOpen = signal(false);
  protected readonly deletePagesOpen = signal(false);
  protected readonly splitOpen = signal(false);
  protected readonly mergeOpen = signal(false);
  protected readonly addText = signal('');
  protected readonly addSize = signal('12');
  protected readonly addColor = signal('#000000');
  protected readonly mergeFiles = signal<File[]>([]);
  protected readonly maxSize = 50 * 1024 * 1024;
  private addPoint: Point = { x: 72, y: 720 };

  protected onAddAt(point: Point): void {
    this.addPoint = point;
    this.addText.set('');
    this.addOpen.set(true);
  }

  protected async confirmAdd(): Promise<void> {
    const text = this.addText().trim();
    const size = Number(this.addSize()) || 12;
    if (!text) {
      return;
    }
    this.addOpen.set(false);
    await this.store.addText({
      page: this.store.selectedPage(),
      text,
      x: this.addPoint.x,
      y: this.addPoint.y,
      size,
      color: this.addColor() || '#000000',
    });
  }

  protected async confirmDeleteRun(): Promise<void> {
    this.deleteRunOpen.set(false);
    await this.store.deleteSelectedRun();
  }

  protected async confirmDeletePages(): Promise<void> {
    this.deletePagesOpen.set(false);
    await this.store.deleteCheckedPages();
  }

  protected async confirmSplit(): Promise<void> {
    this.splitOpen.set(false);
    await this.store.splitChecked();
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
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
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
    if (typing) {
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.store.selectedRun()) {
        event.preventDefault();
        this.deleteRunOpen.set(true);
      }
    }
    if (event.key === 'Escape') {
      this.store.selectRun(null);
      this.store.setTool('select');
    }
  }
}
