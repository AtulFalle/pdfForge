import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElSeparator } from '../../ui/separator/separator';
import { ElStack } from '../../ui/stack/stack';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import { EditorStore, ZOOM_STEP } from './editor-store';

@Component({
  selector: 'app-editor-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElButton, ElSeparator, ElStack, ElTooltip],
  styleUrl: './editor-tools.scss',
  template: `
    <div class="editor-tools" role="toolbar" aria-label="Editing tools">
      <el-stack direction="row" gap="2" align="center">
        <el-button
          [variant]="store.tool() === 'select' ? 'secondary' : 'ghost'"
          size="sm"
          iconStart="arrow-pointer"
          ariaLabel="Select text"
          elTooltip="Select"
          (click)="store.setTool('select')"
        >
          Select
        </el-button>
        <el-button
          [variant]="store.tool() === 'add-text' ? 'secondary' : 'ghost'"
          size="sm"
          iconStart="i-cursor"
          ariaLabel="Add text"
          elTooltip="Text"
          (click)="store.setTool('add-text')"
        >
          Text
        </el-button>
        <el-button
          variant="ghost"
          size="sm"
          iconStart="pencil"
          ariaLabel="Draw"
          elTooltip="Drawing is not available yet"
          disabled
        >
          Draw
        </el-button>
      </el-stack>

      <el-stack direction="row" gap="2" align="center">
        <el-button
          variant="icon"
          size="sm"
          iconStart="minus"
          ariaLabel="Zoom out"
          elTooltip="Zoom out"
          [disabled]="store.zoom() <= 50"
          (click)="store.bumpZoom(-step)"
        />
        <span class="editor-tools__zoom">{{ store.zoom() }}%</span>
        <el-button
          variant="icon"
          size="sm"
          iconStart="plus"
          ariaLabel="Zoom in"
          elTooltip="Zoom in"
          [disabled]="store.zoom() >= 200"
          (click)="store.bumpZoom(step)"
        />
        <el-separator orientation="vertical" />
        <el-button
          variant="ghost"
          size="sm"
          ariaLabel="Fit page to workspace"
          elTooltip="Fit"
          (click)="store.fitZoom()"
        >
          Fit
        </el-button>
      </el-stack>
    </div>
  `,
})
export class EditorTools {
  protected readonly store = inject(EditorStore);
  protected readonly step = ZOOM_STEP;
}
