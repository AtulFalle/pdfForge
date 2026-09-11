import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElContainer } from '../../ui/container/container';
import { ElEmptyState } from '../../ui/empty-state/empty-state';
import { ElFileUpload } from '../../ui/file-upload/file-upload';
import { ElProgress } from '../../ui/progress/progress';
import { ElStack } from '../../ui/stack/stack';
import { EditorStore } from '../editor/editor-store';

@Component({
  selector: 'app-document-open',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElButton, ElContainer, ElEmptyState, ElFileUpload, ElProgress, ElStack],
  styleUrl: './document-open.scss',
  template: `
    <el-container size="md">
      <el-empty-state
        icon="file-pdf"
        title="PDFForge"
        description="Edit the PDF itself — real text, original fonts, no overlay boxes."
      >
        <el-stack gap="4">
          <ul class="document-open__points">
            <li>Search, select, and replace existing text</li>
            <li>Rotate, merge, split, and export pages</li>
            <li>No accounts. No document cloud.</li>
          </ul>
          @if (store.busy()) {
            <el-progress indeterminate aria-label="Opening PDF" />
          }
          <el-file-upload
            [(files)]="files"
            accept="application/pdf,.pdf"
            [maxSize]="maxSize"
            [disabled]="store.busy()"
            dropTitle="Drop a PDF here"
            browseLabel="Browse PDFs"
          >
            Up to 50 MB. Processed in your session — never sent to a third-party PDF service.
          </el-file-upload>
        </el-stack>
        <div elEmptyStateActions>
          <el-button
            variant="primary"
            iconStart="folder-open"
            [disabled]="store.busy() || files().length === 0"
            (click)="open()"
          >
            Open PDF
          </el-button>
        </div>
      </el-empty-state>
    </el-container>
  `,
})
export class DocumentOpen {
  protected readonly store = inject(EditorStore);
  protected readonly files = signal<File[]>([]);
  protected readonly maxSize = 50 * 1024 * 1024;
  private lastOpened: File | null = null;

  constructor() {
    effect(() => {
      const file = this.files()[0];
      if (!file || file === this.lastOpened || this.store.busy()) {
        return;
      }
      void this.open();
    });
  }

  protected async open(): Promise<void> {
    const file = this.files()[0];
    if (!file) {
      return;
    }
    this.lastOpened = file;
    await this.store.openDocument(file);
  }
}
