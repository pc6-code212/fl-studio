import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PianoRow } from '@features/studio/models/studio.model';

export interface NoteToggleEvent {
  row: number;
  step: number;
}

@Component({
  selector: 'app-piano-roll',
  standalone: true,
  templateUrl: './piano-roll.component.html',
  styleUrl: './piano-roll.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PianoRollComponent {
  readonly rows = input.required<PianoRow[]>();
  readonly steps = input.required<number[]>();
  readonly currentStep = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly channelName = input.required<string>();

  readonly toggleNote = output<NoteToggleEvent>();
}
