import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElInput } from '../../ui/input/input';
import {
  ElPopover,
  ElPopoverPanel,
  ElPopoverTrigger,
} from '../../ui/popover/popover';
import { ElStack } from '../../ui/stack/stack';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import type { PendingAdd, TextRun } from '../../core/api/models';
import { EditorStore } from './editor-store';

const COLOR_SWATCHES = ['#000000', '#1f2937', '#b91c1c', '#1d4ed8', '#15803d', '#a16207'];

@Component({
  selector: 'app-text-format-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElButton,
    ElInput,
    ElPopover,
    ElPopoverPanel,
    ElPopoverTrigger,
    ElStack,
    ElTooltip,
  ],
  styleUrl: './text-format-bar.scss',
  template: `
    <div class="text-format-bar" role="toolbar" aria-label="Text actions">
      @if (run(); as selected) {
        <el-button
          variant="secondary"
          size="sm"
          iconStart="i-cursor"
          ariaLabel="Edit text"
          elTooltip="Edit text"
          (click)="edit.emit()"
        >
          Edit
        </el-button>
        <el-button
          variant="icon"
          size="sm"
          iconStart="trash"
          ariaLabel="Delete text"
          elTooltip="Delete text"
          [disabled]="store.busy()"
          (click)="deleteRun.emit()"
        />
      } @else if (pending(); as draft) {
        <el-input
          class="text-format-bar__size"
          type="number"
          size="sm"
          ariaLabel="Font size"
          [value]="'' + draft.size"
          (valueChange)="onSize($event)"
        />
        <el-popover position="bottom" [arrow]="false">
          <el-button
            elPopoverTrigger
            variant="ghost"
            size="sm"
            ariaLabel="Text color"
            elTooltip="Color"
          >
            <span class="text-format-bar__swatch" [style.background]="draft.color"></span>
          </el-button>
          <el-popover-panel>
            <el-stack gap="2">
              <el-stack direction="row" gap="2" wrap>
                @for (swatch of swatches; track swatch) {
                  <button
                    type="button"
                    class="text-format-bar__swatch-btn"
                    [style.background]="swatch"
                    [attr.aria-label]="'Color ' + swatch"
                    (click)="onColor(swatch)"
                  ></button>
                }
              </el-stack>
              <el-input
                type="text"
                size="sm"
                placeholder="#000000"
                ariaLabel="Hex color"
                [value]="draft.color"
                (valueChange)="onColor($event)"
              />
            </el-stack>
          </el-popover-panel>
        </el-popover>
      }
    </div>
  `,
})
export class TextFormatBar {
  protected readonly store = inject(EditorStore);
  protected readonly swatches = COLOR_SWATCHES;

  readonly run = input<TextRun | null>(null);
  readonly pending = input<PendingAdd | null>(null);
  readonly edit = output<void>();
  readonly deleteRun = output<void>();

  protected onSize(value: string): void {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) {
      return;
    }
    this.store.updatePendingAdd({ size });
  }

  protected onColor(value: string): void {
    this.store.updatePendingAdd({ color: value || '#000000' });
  }
}
