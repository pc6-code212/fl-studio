import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PanelId, PanelStates } from '@features/studio/models/studio.model';

export interface PatternListItem {
  number: number;
  name: string;
}

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
  readonly patternList = input.required<PatternListItem[]>();
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
  readonly patternSelect = output<number>();
  readonly patternAdd = output<void>();

  readonly patternMenuOpen = signal(false);

  togglePatternMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.patternMenuOpen.update(open => !open);
  }

  selectPattern(number: number): void {
    this.patternMenuOpen.set(false);
    this.patternSelect.emit(number);
  }

  @HostListener('document:pointerdown', ['$event'])
  closePatternMenu(event: PointerEvent): void {
    if (!(event.target as HTMLElement).closest('.pattern-dropdown')) {
      this.patternMenuOpen.set(false);
    }
  }
}
