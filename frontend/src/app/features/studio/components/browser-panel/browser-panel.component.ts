import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  BrowserSection,
  BrowserTab,
  FlatNode,
  LibraryNode,
  LibraryResponse
} from '@features/studio/models/studio.model';
import { formatSize } from '@shared/utils/format';

@Component({
  selector: 'app-browser-panel',
  standalone: true,
  templateUrl: './browser-panel.component.html',
  styleUrl: './browser-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowserPanelComponent {
  readonly tab = input.required<BrowserTab>();
  readonly sections = input.required<BrowserSection[]>();
  readonly library = input<LibraryResponse | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string>('');
  readonly openMessage = input<string>('');

  readonly tabChange = output<BrowserTab>();
  readonly reload = output<void>();
  readonly openFolder = output<string>();
  readonly previewFile = output<LibraryNode>();

  folderNodes(name: 'samples' | 'effects' | 'instruments'): LibraryNode[] {
    return this.library()?.folders?.[name] ?? [];
  }

  flatten(nodes: LibraryNode[], depth = 0): FlatNode[] {
    const out: FlatNode[] = [];
    for (const node of nodes) {
      out.push({ node, depth });
      if (node.children && node.children.length) {
        out.push(...this.flatten(node.children, depth + 1));
      }
    }
    return out;
  }

  onNodeClick(node: LibraryNode): void {
    if (node.type === 'file') {
      this.previewFile.emit(node);
    }
  }

  format(size?: number): string {
    return formatSize(size);
  }
}
