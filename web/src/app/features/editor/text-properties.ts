import { ChangeDetectionStrategy, Component, inject, linkedSignal, output } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElEmptyState } from '../../ui/empty-state/empty-state';
import { ElIcon } from '../../ui/icon/icon';
import { ElInput, ElInputPrefix } from '../../ui/input/input';
import { ElLabel } from '../../ui/label/label';
import { ElList, ElListItem } from '../../ui/list/list';
import { ElScrollArea } from '../../ui/scroll-area/scroll-area';
import { ElSeparator } from '../../ui/separator/separator';
import { ElStack } from '../../ui/stack/stack';
import { EditorStore } from './editor-store';

@Component({
  selector: 'app-text-properties',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElButton,
    ElEmptyState,
    ElIcon,
    ElInput,
    ElInputPrefix,
    ElLabel,
    ElList,
    ElListItem,
    ElScrollArea,
    ElSeparator,
    ElStack,
  ],
  styleUrl: './text-properties.scss',
  template: `
    <el-stack gap="4">
      <el-stack gap="2">
        <el-label htmlFor="search">Search</el-label>
        <el-input
          inputId="search"
          type="search"
          placeholder="Find text"
          ariaLabel="Search document text"
          [value]="store.searchQuery()"
          (valueChange)="store.searchQuery.set($event)"
        >
          <el-icon elInputPrefix name="magnifying-glass" />
        </el-input>
      </el-stack>

      @if (store.searchHits.value().length > 0) {
        <el-scroll-area class="text-properties__hits" ariaLabel="Search results">
          <el-list appearance="plain" ariaLabel="Matching text">
            @for (hit of store.searchHits.value(); track hit.id) {
              <el-list-item
                interactive
                [selected]="hit.id === store.selectedRunId()"
                (activated)="store.selectRun(hit.id)"
              >
                <span elListTitle>{{ hit.text }}</span>
                <span elListDescription>Page {{ hit.page }}</span>
              </el-list-item>
            }
          </el-list>
        </el-scroll-area>
      }

      <el-separator />

      @if (store.selectedRun(); as run) {
        <el-stack gap="3">
          <el-label htmlFor="run-text">Selected text</el-label>
          <el-input
            inputId="run-text"
            [value]="draft()"
            (valueChange)="draft.set($event)"
            ariaLabel="Edit selected text"
          />
          <p class="text-properties__meta">
            {{ run.style.font_name }} · {{ run.style.size }}pt · {{ run.style.color }}
          </p>
          <el-stack direction="row" gap="2" wrap>
            <el-button
              variant="primary"
              size="sm"
              [disabled]="store.busy() || draft() === run.text"
              (click)="store.replaceSelected(draft())"
            >
              Apply
            </el-button>
            <el-button
              variant="secondary"
              size="sm"
              [disabled]="store.busy()"
              (click)="deleteRun.emit()"
            >
              Delete text
            </el-button>
          </el-stack>
        </el-stack>
      } @else {
        <el-empty-state
          icon="i-cursor"
          title="No text selected"
          description="Click a text run on the page, or search to jump to a match."
        />
      }
    </el-stack>
  `,
})
export class TextProperties {
  protected readonly store = inject(EditorStore);
  readonly deleteRun = output<void>();
  protected readonly draft = linkedSignal(() => this.store.selectedRun()?.text ?? '');
}
