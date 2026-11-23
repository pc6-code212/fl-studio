import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Channel } from '@features/studio/models/studio.model';

export interface StepToggleEvent {
  id: number;
  step: number;
  active: boolean;
}

export interface ChannelPanEvent {
  id: number;
  pan: number;
}

export interface ChannelVolumeEvent {
  id: number;
  volume: number;
}

export interface ChannelMixerEvent {
  id: number;
  mixerChannel: number;
}

@Component({
  selector: 'app-channel-rack',
  standalone: true,
  imports: [FormsModule],
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

  readonly select = output<number>();
  readonly toggleStep = output<StepToggleEvent>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly preview = output<Channel>();
  readonly openPianoRoll = output<number>();
  readonly panChange = output<ChannelPanEvent>();
  readonly volumeChange = output<ChannelVolumeEvent>();
  readonly mixerChannelChange = output<ChannelMixerEvent>();
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

  onStepContextMenu(event: MouseEvent, id: number, step: number): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    this.toggleStep.emit({ id, step, active: false });
  }

  startPanDrag(event: PointerEvent, channel: Channel): void {
    this.startKnobDrag(event, channel.pan, value =>
      this.panChange.emit({ id: channel.id, pan: value })
    );
  }

  startVolumeDrag(event: PointerEvent, channel: Channel): void {
    this.startKnobDrag(event, channel.volume, value =>
      this.volumeChange.emit({ id: channel.id, volume: value })
    );
  }

  private startKnobDrag(
    event: PointerEvent,
    startValue: number,
    apply: (value: number) => void
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const move = (moveEvent: PointerEvent) => {
      const delta = (startY - moveEvent.clientY) * 0.6;
      apply(Math.max(0, Math.min(100, Math.round(startValue + delta))));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }
}
