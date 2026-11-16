import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  input,
  output
} from '@angular/core';
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
export class PianoRollComponent implements AfterViewInit {
  readonly rows = input.required<PianoRow[]>();
  readonly steps = input.required<number[]>();
  readonly currentStep = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly channelName = input.required<string>();
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);

  readonly toggleNote = output<NoteToggleEvent>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  @ViewChild('body') private body?: ElementRef<HTMLElement>;

  private readonly rowHeight = 22;

  ngAfterViewInit(): void {
    setTimeout(() => this.centerOnNote('C5'), 50);
  }

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

  centerOnNote(label: string): void {
    const container = this.body?.nativeElement;
    if (!container) {
      return;
    }
    const index = this.rows().findIndex(row => row.label === label);
    if (index >= 0) {
      container.scrollTop = Math.max(0, index * this.rowHeight - container.clientHeight / 2);
    }
  }
}
