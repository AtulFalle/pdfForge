import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ElContainer } from './ui/container/container';
import { ElEmptyState } from './ui/empty-state/empty-state';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ElContainer, ElEmptyState],
  styleUrl: './app.scss',
  template: `
    <el-container size="lg">
      <el-empty-state
        icon="folder-open"
        title="PDFForge"
        description="Editor UI is not implemented yet."
      />
    </el-container>
  `,
})
export class App {}
