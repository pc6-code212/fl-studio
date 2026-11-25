import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Channel } from '@features/studio/models/studio.model';

export interface VolumeChangeEvent {
  id: number;
  volume: number;
}

@Component({
  selector: 'app-mixer-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mixer-panel.component.html',
  styleUrl: './mixer-panel.component.css',
  host: { '[class.collapsed]': 'collapsed()' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MixerPanelComponent {
  readonly channels = input.required<Channel[]>();
  readonly masterVolume = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly currentStep = input.required<number>();
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);
  readonly floating = input<boolean>(false);

  readonly volumeChange = output<VolumeChangeEvent>();
  readonly masterVolumeChange = output<number>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  onHeaderDoubleClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    this.floatToggle.emit();
  }

  onHeaderPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    this.headerDrag.emit(event);
  }

  knobAngle(value: number): number {
    return -135 + (value / 100) * 270;
  }

  meterLevel(index: number): number {
    if (!this.isPlaying()) {
      return 0;
    }
    const base = [68, 44, 58, 34, 50, 40, 30, 22][index % 8];
    const jitter = ((this.currentStep() * 37 + index * 13) % 23) - 11;
    return Math.max(8, Math.min(100, base + jitter));
  }
}
