import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElScrollArea } from '../../ui/scroll-area/scroll-area';
import { ElStack } from '../../ui/stack/stack';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import { EditorStore } from '../editor/editor-store';
import { PageThumbnail } from './page-thumbnail';

@Component({
  selector: 'app-page-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElButton, ElScrollArea, ElStack, ElTooltip, PageThumbnail],
  styleUrl: './page-panel.scss',
  template: `
    <el-stack gap="3">
      <el-stack direction="row" gap="2" wrap>
        <el-button
          variant="icon"
          size="sm"
          iconStart="arrows-rotate"
          ariaLabel="Rotate page"
          elTooltip="Rotate"
          [disabled]="store.busy()"
          (click)="store.rotateSelected()"
        />
        <el-button
          variant="icon"
          size="sm"
          iconStart="arrow-up"
          ariaLabel="Move page up"
          elTooltip="Move up"
          [disabled]="store.busy()"
          (click)="store.movePage(-1)"
        />
        <el-button
          variant="icon"
          size="sm"
          iconStart="arrow-down"
          ariaLabel="Move page down"
          elTooltip="Move down"
          [disabled]="store.busy()"
          (click)="store.movePage(1)"
        />
      </el-stack>
      <el-scroll-area class="page-panel__list" ariaLabel="Pages">
        <el-stack gap="3">
          @for (page of store.pages(); track page.number) {
            <app-page-thumbnail [page]="page.number" [active]="page.number === store.selectedPage()" />
          }
        </el-stack>
      </el-scroll-area>
    </el-stack>
  `,
})
export class PagePanel {
  protected readonly store = inject(EditorStore);
}
