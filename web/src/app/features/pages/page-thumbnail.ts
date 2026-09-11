import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { PdfRenderer } from '../../core/pdf/pdf-renderer';
import { ElCheckbox } from '../../ui/checkbox/checkbox';
import { EditorStore } from '../editor/editor-store';

@Component({
  selector: 'app-page-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElCheckbox],
  styleUrl: './page-thumbnail.scss',
  template: `
    <article class="page-thumbnail" [class.page-thumbnail--active]="active()">
      <el-checkbox
        [inputId]="'page-' + page()"
        [checked]="store.isPageChecked(page())"
        (checkedChange)="store.setPageChecked(page(), $event)"
      >
        Page {{ page() }}
      </el-checkbox>
      <button
        type="button"
        class="page-thumbnail__preview"
        [attr.aria-current]="active() ? 'page' : null"
        [attr.aria-label]="'Show page ' + page()"
        (click)="store.selectPage(page())"
      >
        <canvas #canvas></canvas>
      </button>
    </article>
  `,
})
export class PageThumbnail {
  private readonly renderer = inject(PdfRenderer);
  protected readonly store = inject(EditorStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly page = input.required<number>();
  readonly active = input(false);

  constructor() {
    afterRenderEffect(() => {
      const page = this.page();
      const epoch = this.store.fileEpoch();
      const bytes = this.store.pdfData();
      const canvas = this.canvas()?.nativeElement;
      if (!bytes || !canvas) {
        return;
      }
      untracked(() => {
        void this.renderer.renderPage(epoch, bytes, page, canvas, 0.18);
      });
    });
  }
}
