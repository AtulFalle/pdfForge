import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { PdfRenderer } from '../../core/pdf/pdf-renderer';
import { ElButton } from '../../ui/button/button';
import { ElMenu, ElMenuItem, ElMenuPanel, ElMenuTrigger } from '../../ui/menu/menu';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import { EditorStore } from '../editor/editor-store';

@Component({
  selector: 'app-page-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElButton, ElMenu, ElMenuItem, ElMenuPanel, ElMenuTrigger, ElTooltip],
  styleUrl: './page-thumbnail.scss',
  template: `
    <article class="page-thumbnail" [class.page-thumbnail--active]="active()">
      <button
        type="button"
        class="page-thumbnail__preview"
        [attr.aria-current]="active() ? 'page' : null"
        [attr.aria-label]="'Show page ' + page()"
        (click)="store.selectPage(page())"
      >
        <canvas #canvas></canvas>
      </button>

      <div class="page-thumbnail__meta">
        <span class="page-thumbnail__number">{{ page() }}</span>
        <el-menu>
          <el-button
            elMenuTrigger
            class="page-thumbnail__menu-trigger"
            variant="icon"
            size="sm"
            iconStart="ellipsis-vertical"
            ariaLabel="Page actions"
            elTooltip="Page actions"
          />
          <el-menu-panel>
            <el-menu-item
              icon="arrows-rotate"
              [disabled]="store.busy()"
              (selected)="store.rotatePage(page())"
            >
              Rotate
            </el-menu-item>
            <el-menu-item
              icon="copy"
              [disabled]="store.busy()"
              (selected)="store.duplicatePage(page())"
            >
              Duplicate
            </el-menu-item>
            <el-menu-item
              icon="arrow-up"
              [disabled]="store.busy() || isFirst()"
              (selected)="store.movePage(page(), -1)"
            >
              Move up
            </el-menu-item>
            <el-menu-item
              icon="arrow-down"
              [disabled]="store.busy() || isLast()"
              (selected)="store.movePage(page(), 1)"
            >
              Move down
            </el-menu-item>
            <el-menu-item
              icon="scissors"
              [disabled]="store.busy()"
              (selected)="splitPage.emit(page())"
            >
              Split
            </el-menu-item>
            <el-menu-item
              variant="danger"
              icon="trash"
              [disabled]="store.busy() || store.pageCount() <= 1"
              (selected)="deletePage.emit(page())"
            >
              Delete
            </el-menu-item>
          </el-menu-panel>
        </el-menu>
      </div>
    </article>
  `,
})
export class PageThumbnail {
  private readonly renderer = inject(PdfRenderer);
  protected readonly store = inject(EditorStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly page = input.required<number>();
  readonly active = input(false);
  readonly splitPage = output<number>();
  readonly deletePage = output<number>();

  protected readonly isFirst = computed(() => this.store.pageIndex(this.page()) === 0);
  protected readonly isLast = computed(
    () => this.store.pageIndex(this.page()) === this.store.pageCount() - 1,
  );

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
        void this.renderer.renderPage(epoch, bytes, page, canvas, 0.2);
      });
    });
  }
}
