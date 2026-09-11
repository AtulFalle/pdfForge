import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ElButton } from '../../ui/button/button';
import { ElMenu, ElMenuItem, ElMenuPanel, ElMenuTrigger } from '../../ui/menu/menu';
import { ElSeparator } from '../../ui/separator/separator';
import { ElSlider } from '../../ui/slider/slider';
import { ElStack } from '../../ui/stack/stack';
import { ElTooltip } from '../../ui/tooltip/tooltip';
import { EditorStore } from './editor-store';

@Component({
  selector: 'app-editor-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ElButton,
    ElMenu,
    ElMenuItem,
    ElMenuPanel,
    ElMenuTrigger,
    ElSeparator,
    ElSlider,
    ElStack,
    ElTooltip,
  ],
  styleUrl: './editor-toolbar.scss',
  template: `
    <header class="editor-toolbar">
      <el-stack direction="row" gap="2" align="center">
        <span class="editor-toolbar__title">{{ store.fileName() }}</span>
        <el-button
          variant="icon"
          iconStart="folder-open"
          ariaLabel="Close document"
          elTooltip="Close"
          [disabled]="store.busy()"
          (click)="store.closeDocument()"
        />
      </el-stack>

      <el-stack direction="row" gap="2" align="center">
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
        <el-separator orientation="vertical" />
        <el-button
          [variant]="store.tool() === 'select' ? 'secondary' : 'icon'"
          iconStart="arrow-pointer"
          ariaLabel="Select text"
          elTooltip="Select"
          (click)="store.setTool('select')"
        />
        <el-button
          [variant]="store.tool() === 'add-text' ? 'secondary' : 'icon'"
          iconStart="plus"
          ariaLabel="Add text"
          elTooltip="Add text"
          (click)="store.setTool('add-text')"
        />
        <el-separator orientation="vertical" />
        <el-slider
          class="editor-toolbar__zoom"
          [value]="store.zoom()"
          (valueChange)="store.zoom.set($event)"
          [min]="50"
          [max]="200"
          [step]="10"
          ariaLabel="Zoom"
        />
        <span class="editor-toolbar__zoom-label">{{ store.zoom() }}%</span>
      </el-stack>

      <el-stack direction="row" gap="2" align="center">
        <el-menu>
          <el-button elMenuTrigger variant="secondary" iconStart="file-lines" size="sm">
            Pages
          </el-button>
          <el-menu-panel>
            <el-menu-item icon="arrows-rotate" (selected)="store.rotateSelected()">Rotate 90°</el-menu-item>
            <el-menu-item icon="arrow-up" (selected)="store.movePage(-1)">Move up</el-menu-item>
            <el-menu-item icon="arrow-down" (selected)="store.movePage(1)">Move down</el-menu-item>
            <el-menu-item icon="scissors" (selected)="split.emit()">Split selected</el-menu-item>
            <el-menu-item icon="file-import" (selected)="merge.emit()">Merge PDF</el-menu-item>
            <el-menu-item variant="danger" icon="trash" (selected)="deletePages.emit()">
              Delete pages
            </el-menu-item>
          </el-menu-panel>
        </el-menu>
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
  readonly split = output<void>();
  readonly merge = output<void>();
  readonly deletePages = output<void>();
}
