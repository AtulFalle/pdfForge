import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TextRun } from '../../core/api/models';
import { bboxToCss, type PointMapper } from '../../core/pdf/bbox';

@Component({
  selector: 'app-text-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      ></button>
    }
  `,
})
export class TextOverlay {
  readonly runs = input.required<TextRun[]>();
  readonly selectedId = input<string | null>(null);
  readonly searchIds = input<ReadonlySet<string>>(new Set());
  readonly mapper = input.required<PointMapper>();
  readonly select = output<string>();

  protected readonly hits = computed(() => {
    const toViewport = this.mapper();
    const searchIds = this.searchIds();
    return this.runs().map((run) => ({
      run,
      search: searchIds.has(run.id),
      box: bboxToCss(run.bbox, toViewport),
    }));
  });
}
