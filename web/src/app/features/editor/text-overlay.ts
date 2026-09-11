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
import type { PendingAdd, TextRun } from '../../core/api/models';
import { bboxToCss, type CssBox, type PointMapper } from '../../core/pdf/bbox';
import { TextFormatBar } from './text-format-bar';

const HIT_PAD_PX = 4;

function padHitBox(box: CssBox): CssBox {
  return {
    left: box.left - HIT_PAD_PX,
    top: box.top - HIT_PAD_PX,
    width: box.width + HIT_PAD_PX * 2,
    height: box.height + HIT_PAD_PX * 2,
  };
}

@Component({
  selector: 'app-text-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextFormatBar],
  styleUrl: './text-overlay.scss',
  template: `
    @for (hit of hits(); track hit.run.id) {
      <button
        type="button"
        class="text-overlay__hit"
        [class.text-overlay__hit--selected]="hit.run.id === selectedId()"
        [class.text-overlay__hit--search]="hit.search"
        [style.left.px]="hit.box.left"
        [style.top.px]="hit.box.top"
        [style.width.px]="hit.box.width"
        [style.height.px]="hit.box.height"
        [attr.aria-label]="'Select text: ' + hit.run.text"
        [attr.aria-pressed]="hit.run.id === selectedId()"
        (click)="select.emit(hit.run.id); $event.stopPropagation()"
        (dblclick)="edit.emit(hit.run.id); $event.stopPropagation()"
      ></button>
    }

    @if (selectedFormat(); as format) {
      <div
        class="text-overlay__format"
        [style.left.px]="format.left"
        [style.top.px]="format.top"
        (click)="$event.stopPropagation()"
        (mousedown)="$event.preventDefault()"
      >
        <app-text-format-bar
          [run]="format.run"
          (edit)="edit.emit(format.run.id)"
          (deleteRun)="deleteRun.emit()"
        />
      </div>
    }

    @if (pending(); as add) {
      @if (pendingBox(); as box) {
        <div
          class="text-overlay__pending-anchor"
          [style.left.px]="box.left"
          [style.top.px]="box.top"
          [style.width.px]="box.width"
          [style.height.px]="box.height"
        >
          <input
            #pendingField
            class="text-overlay__pending"
            type="text"
            placeholder="Type here..."
            [value]="add.text"
            [style.fontSize.px]="add.size * zoomScale()"
            [style.color]="add.color"
            aria-label="New text"
            (input)="onPendingInput($event)"
            (keydown)="onPendingKey($event)"
            (blur)="onPendingBlur()"
            (click)="$event.stopPropagation()"
          />
        </div>
        <div
          class="text-overlay__format"
          [style.left.px]="box.left"
          [style.top.px]="box.top - 48"
          (click)="$event.stopPropagation()"
          (mousedown)="$event.preventDefault()"
        >
          <app-text-format-bar [pending]="add" />
        </div>
      }
    }
  `,
})
export class TextOverlay {
  private readonly pendingField = viewChild<ElementRef<HTMLInputElement>>('pendingField');
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly runs = input.required<TextRun[]>();
  readonly selectedId = input<string | null>(null);
  readonly editingId = input<string | null>(null);
  readonly searchIds = input<ReadonlySet<string>>(new Set());
  readonly mapper = input.required<PointMapper>();
  readonly zoomScale = input(1);
  readonly pending = input<PendingAdd | null>(null);

  readonly select = output<string>();
  readonly edit = output<string>();
  readonly deleteRun = output<void>();
  readonly pendingText = output<string>();
  readonly pendingCommit = output<void>();
  readonly pendingCancel = output<void>();

  protected readonly hits = computed(() => {
    const toViewport = this.mapper();
    const searchIds = this.searchIds();
    return this.runs().map((run) => ({
      run,
      search: searchIds.has(run.id),
      box: padHitBox(bboxToCss(run.bbox, toViewport)),
    }));
  });

  protected readonly selectedFormat = computed(() => {
    const selectedId = this.selectedId();
    if (!selectedId || this.editingId() || this.pending()) {
      return null;
    }
    const hit = this.hits().find((item) => item.run.id === selectedId);
    if (!hit) {
      return null;
    }
    return {
      run: hit.run,
      left: hit.box.left,
      top: Math.max(0, hit.box.top - 44),
    };
  });

  protected readonly pendingBox = computed(() => {
    const pending = this.pending();
    const toViewport = this.mapper();
    if (!pending) {
      return null;
    }
    const origin = toViewport(pending.x, pending.y);
    const height = pending.size * this.zoomScale() * 1.2;
    return {
      left: origin.x,
      top: origin.y - height,
      width: Math.max(160, pending.size * this.zoomScale() * 8),
      height,
    };
  });

  constructor() {
    afterRenderEffect(() => {
      if (!this.pending()) {
        return;
      }
      untracked(() => {
        queueMicrotask(() => this.pendingField()?.nativeElement.focus());
      });
    });
  }

  protected onPendingInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.pendingText.emit(target.value);
    }
  }

  protected onPendingKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.pendingCommit.emit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.pendingCancel.emit();
    }
  }

  protected onPendingBlur(): void {
    queueMicrotask(() => {
      const active = this.host.nativeElement.ownerDocument.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.closest('.text-format-bar') || active.closest('.el-popover-panel'))
      ) {
        this.pendingField()?.nativeElement.focus();
        return;
      }
      this.pendingCommit.emit();
    });
  }
}
