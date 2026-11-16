import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PanelId, PanelStates } from '@features/studio/models/studio.model';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent {
  readonly bpm = input.required<number>();
  readonly swing = input.required<number>();
  readonly masterVolume = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly isRecording = input.required<boolean>();
  readonly songMode = input.required<boolean>();
  readonly patternNumber = input.required<number>();
  readonly patternName = input.required<string>();
  readonly keyboardPiano = input.required<boolean>();
  readonly panels = input.required<PanelStates>();

  readonly playToggle = output<void>();
  readonly stopPressed = output<void>();
  readonly recordToggle = output<void>();
  readonly keyboardPianoToggle = output<void>();
  readonly panelToggle = output<PanelId>();
  readonly songModeChange = output<boolean>();
  readonly bpmChange = output<number>();
  readonly swingChange = output<number>();
  readonly prevPattern = output<void>();
  readonly nextPattern = output<void>();
}
