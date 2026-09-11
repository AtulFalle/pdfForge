import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { PageViewport } from 'pdfjs-dist';
import { PdfRenderer } from '../../core/pdf/pdf-renderer';
import type { PointMapper } from '../../core/pdf/bbox';
import { ElProgress } from '../../ui/progress/progress';
import { ElScrollArea } from '../../ui/scroll-area/scroll-area';
import { EditorStore } from './editor-store';
import { TextOverlay } from './text-overlay';

@Component({
  selector: 'app-pdf-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElProgress, ElScrollArea, TextOverlay],
  styleUrl: './pdf-viewer.scss',
  template: `
    <div #scrollHost class="pdf-viewer__frame">
      <el-scroll-area class="pdf-viewer__scroll" ariaLabel="PDF page" orientation="both">
        @if (store.busy() && !viewport()) {
          <el-progress indeterminate />
        }
        <div class="pdf-viewer__stage">
          <div
            class="pdf-viewer__page"
            [class.pdf-viewer__page--add]="store.tool() === 'add-text'"
            [style.width.px]="width()"
            [style.height.px]="height()"
            (click)="onPageClick($event)"
          >
            <canvas #canvas class="pdf-viewer__canvas"></canvas>
            @if (mapper(); as toViewport) {
              <app-text-overlay
                [runs]="store.pageRuns()"
                [selectedId]="store.selectedRunId()"
                [editingId]="store.editingRunId()"
                [searchIds]="searchIds()"
                [mapper]="toViewport"
                [zoomScale]="store.zoom() / 100"
                [pending]="store.pendingAdd()"
                (select)="store.selectRun($event)"
                (edit)="store.beginEditRun($event)"
                (deleteRun)="deleteRun.emit()"
                (pendingText)="store.updatePendingAdd({ text: $event })"
                (pendingCommit)="store.commitPendingAdd()"
                (pendingCancel)="store.cancelPendingAdd()"
              />
            }
          </div>
        </div>
      </el-scroll-area>
    </div>
  `,
})
export class PdfViewer {
  private readonly renderer = inject(PdfRenderer);
  protected readonly store = inject(EditorStore);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scrollHost = viewChild.required<ElementRef<HTMLElement>>('scrollHost');

  readonly deleteRun = output<void>();
  protected readonly viewport = signal<PageViewport | null>(null);
  protected readonly width = signal(0);
  protected readonly height = signal(0);
  protected readonly mapper = signal<PointMapper | null>(null);
  protected readonly searchIds = computed(
    () => new Set(this.store.searchHits.value().map((run) => run.id)),
  );

  constructor() {
    afterRenderEffect((onCleanup) => {
      const epoch = this.store.fileEpoch();
      const page = this.store.selectedPage();
      const zoom = this.store.zoom();
      const bytes = this.store.pdfData();
      const canvas = this.canvas()?.nativeElement;
      if (!bytes || !canvas) {
        return;
      }
      untracked(() => {
        void this.draw(epoch, bytes, page, zoom, canvas);
      });
    });

    afterRenderEffect((onCleanup) => {
      const host = this.scrollHost()?.nativeElement;
      if (!host) {
        return;
      }
      const update = () => {
        this.store.setViewportSize({
          width: host.clientWidth,
          height: host.clientHeight,
        });
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(host);
      onCleanup(() => observer.disconnect());
    });
  }

  protected onPageClick(event: MouseEvent): void {
    if (this.store.tool() !== 'add-text') {
      if (!(event.target instanceof HTMLButtonElement)) {
        this.store.selectRun(null);
      }
      return;
    }
    const viewport = this.viewport();
    const canvas = this.canvas()?.nativeElement;
    if (!viewport || !canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const pdf = viewport.convertToPdfPoint(x, y);
    this.store.startPendingAdd(this.store.selectedPage(), pdf[0], pdf[1]);
  }

  private async draw(
    epoch: number,
    bytes: Uint8Array,
    page: number,
    zoom: number,
    canvas: HTMLCanvasElement,
  ): Promise<void> {
    try {
      const rendered = await this.renderer.renderPage(epoch, bytes, page, canvas, zoom / 100);
      this.viewport.set(rendered.viewport);
      this.width.set(rendered.width);
      this.height.set(rendered.height);
      const viewport = rendered.viewport;
      this.mapper.set((x, y) => {
        const point = viewport.convertToViewportPoint(x, y);
        return { x: point[0], y: point[1] };
      });
    } catch {
      this.mapper.set(null);
    }
  }
}
