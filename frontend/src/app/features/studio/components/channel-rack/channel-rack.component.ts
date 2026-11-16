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

  readonly select = output<number>();
  readonly toggleStep = output<StepToggleEvent>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly preview = output<Channel>();

  knobAngle(value: number): number {
    return -135 + (value / 100) * 270;
  }
}
