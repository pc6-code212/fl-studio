import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Channel } from '@features/studio/models/studio.model';

export interface StepToggleEvent {
  id: number;
  step: number;
}

@Component({
  selector: 'app-channel-rack',
  standalone: true,
  templateUrl: './channel-rack.component.html',
  styleUrl: './channel-rack.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChannelRackComponent {
  readonly channels = input.required<Channel[]>();
  readonly steps = input.required<number[]>();
  readonly selected = input.required<number>();
  readonly currentStep = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);
  readonly floating = input<boolean>(false);

  readonly select = output<number>();
  readonly toggleStep = output<StepToggleEvent>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly preview = output<Channel>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  onHeaderPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    this.headerDrag.emit(event);
  }

  knobAngle(value: number): number {
    return -135 + (value / 100) * 270;
  }
}
