import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElIcon } from '../../ui/icon/icon';
import { ElInput, ElInputPrefix } from '../../ui/input/input';
import { ElList, ElListItem } from '../../ui/list/list';
import {
  ElPopover,
  ElPopoverClose,
  ElPopoverPanel,
  ElPopoverTrigger,
} from '../../ui/popover/popover';
import { ElScrollArea } from '../../ui/scroll-area/scroll-area';
import { ElSeparator } from '../../ui/separator/separator';
import { ElStack } from '../../ui/stack/stack';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import { EditorStore } from './editor-store';

@Component({
  selector: 'app-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElButton,
    ElIcon,
    ElInput,
    ElInputPrefix,
    ElList,
    ElListItem,
    ElPopover,
    ElPopoverClose,
    ElPopoverPanel,
    ElPopoverTrigger,
    ElScrollArea,
    ElSeparator,
    ElStack,
    ElTooltip,
  ],
  styleUrl: './editor-toolbar.scss',
  template: `
    <header class="editor-toolbar">
      <el-stack direction="row" gap="2" align="center" class="editor-toolbar__brand">
        <span class="editor-toolbar__product">PDFForge</span>
        <el-separator orientation="vertical" />
        <span class="editor-toolbar__title" [attr.title]="store.fileName()">{{
          store.fileName()
        }}</span>
        <el-button
          variant="icon"
          iconStart="xmark"
          size="sm"
          ariaLabel="Close document"
          elTooltip="Close"
          [disabled]="store.busy()"
          (click)="store.closeDocument()"
        />
      </el-stack>

      <el-stack direction="row" gap="2" align="center" class="editor-toolbar__history">
        <el-button
          variant="icon"
          iconStart="rotate-left"
          ariaLabel="Undo"
          elTooltip="Undo"
          [disabled]="store.busy() || !store.canUndo()"
          (click)="store.undo()"
        />
        <el-button
          variant="icon"
          iconStart="rotate-right"
          ariaLabel="Redo"
          elTooltip="Redo"
          [disabled]="store.busy() || !store.canRedo()"
          (click)="store.redo()"
        />
      </el-stack>

      <el-stack direction="row" gap="2" align="center" class="editor-toolbar__actions">
        <el-popover
          [open]="store.searchOpen()"
          (openChange)="store.searchOpen.set($event)"
          position="bottom"
          ariaLabel="Search PDF"
        >
          <el-button
            elPopoverTrigger
            variant="icon"
            iconStart="magnifying-glass"
            ariaLabel="Search PDF"
            elTooltip="Search"
          />
          <el-popover-panel class="editor-toolbar__search">
            <el-stack gap="3">
              <el-stack direction="row" gap="2" align="center">
                <el-input
                  class="editor-toolbar__search-input"
                  type="search"
                  placeholder="Search PDF..."
                  ariaLabel="Search PDF text"
                  [value]="store.searchQuery()"
                  (valueChange)="store.searchQuery.set($event)"
                >
                  <el-icon elInputPrefix name="magnifying-glass" />
                </el-input>
                <el-button
                  elPopoverClose
                  variant="icon"
                  iconStart="xmark"
                  size="sm"
                  ariaLabel="Close search"
                />
              </el-stack>
              @if (store.debouncedQuery().trim()) {
                <p class="editor-toolbar__search-count">
                  {{ store.searchHits.value().length }} result{{
                    store.searchHits.value().length === 1 ? '' : 's'
                  }}
                </p>
                <el-scroll-area class="editor-toolbar__hits" ariaLabel="Search results">
                  <el-list appearance="plain" ariaLabel="Matching text">
                    @for (hit of store.searchHits.value(); track hit.id) {
                      <el-list-item
                        interactive
                        [selected]="hit.id === store.selectedRunId()"
                        (activated)="onHit(hit.id)"
                      >
                        <span elListTitle>{{ hit.text }}</span>
                        <span elListDescription>Page {{ hit.page }}</span>
                      </el-list-item>
                    }
                  </el-list>
                </el-scroll-area>
              }
            </el-stack>
          </el-popover-panel>
        </el-popover>

        <el-button
          variant="icon"
          iconStart="file-import"
          ariaLabel="Merge PDF"
          elTooltip="Merge"
          [disabled]="store.busy()"
          (click)="merge.emit()"
        />
        <el-button
          variant="primary"
          iconStart="download"
          size="sm"
          [disabled]="store.busy()"
          (click)="store.exportDocument()"
        >
          Export
        </el-button>
      </el-stack>
    </header>
  `,
})
export class EditorToolbar {
  protected readonly store = inject(EditorStore);
  readonly merge = output<void>();

  protected onHit(id: string): void {
    this.store.selectRun(id);
    this.store.searchOpen.set(false);
  }
}
