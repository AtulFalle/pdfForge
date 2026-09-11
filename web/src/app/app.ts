import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DocumentOpen } from './features/documents/document-open';
import { EditorShell } from './features/editor/editor-shell';
import { EditorStore } from './features/editor/editor-store';
import { ElToaster } from './ui/toast/toaster';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentOpen, EditorShell, ElToaster],
  styleUrl: './app.scss',
  template: `
    <el-toaster />
    @if (store.hasSession()) {
      <app-editor-shell />
    } @else {
      <app-document-open />
    }
  `,
})
export class App {
  protected readonly store = inject(EditorStore);
}
