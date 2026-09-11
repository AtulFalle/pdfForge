import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ElScrollArea } from '../../ui/scroll-area/scroll-area';
import { EditorStore } from '../editor/editor-store';
import { PageThumbnail } from './page-thumbnail';

@Component({
  selector: 'app-page-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElScrollArea, PageThumbnail],
  styleUrl: './page-panel.scss',
  template: `
    <div class="page-panel">
      <h2 class="page-panel__title">Pages</h2>
      <el-scroll-area class="page-panel__list" ariaLabel="Pages">
        <div class="page-panel__items">
          @for (page of store.pages(); track page.number) {
            <app-page-thumbnail
              [page]="page.number"
              [active]="page.number === store.selectedPage()"
              (splitPage)="splitPage.emit($event)"
              (deletePage)="deletePage.emit($event)"
            />
          }
        </div>
      </el-scroll-area>
    </div>
  `,
})
export class PagePanel {
  protected readonly store = inject(EditorStore);
  readonly splitPage = output<number>();
  readonly deletePage = output<number>();
}
