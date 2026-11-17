import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { PianoRow } from '@features/studio/models/studio.model';

export interface NoteToggleEvent {
  row: number;
  step: number;
  active: boolean;
}

export interface NoteResizeEvent {
  row: number;
  oldStart: number;
  start: number;
  length: number;
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
  readonly pressedNotes = input<string[]>([]);
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);

  readonly toggleNote = output<NoteToggleEvent>();
  readonly resizeNote = output<NoteResizeEvent>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  @ViewChild('body') private body?: ElementRef<HTMLElement>;

  private readonly rowHeight = 22;

  readonly snap = signal(true);
  readonly snapDivision = signal(4);
  readonly snapSteps = computed(() => 4 / this.snapDivision());

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

  isPressed(label: string): boolean {
    return this.pressedNotes().includes(label);
  }

  setSnapDivision(event: Event): void {
    this.snapDivision.set(Number((event.target as HTMLSelectElement).value) || 4);
  }

  noteLength(rowIndex: number, step: number): number {
    return this.rows()[rowIndex]?.lengths[step] ?? 1;
  }

  notesInRow(rowIndex: number): { start: number; length: number }[] {
    const row = this.rows()[rowIndex];
    if (!row) {
      return [];
    }
    const result: { start: number; length: number }[] = [];
    for (let s = 0; s < this.steps().length; s++) {
      if (row.notes[s]) {
        result.push({ start: s, length: row.lengths[s] ?? 1 });
      }
    }
    return result;
  }

  isCovered(rowIndex: number, step: number): boolean {
    const row = this.rows()[rowIndex];
    if (!row || row.notes[step]) {
      return false;
    }
    for (let i = 0; i < step; i++) {
      if (row.notes[i]) {
        const length = row.lengths[i] ?? 1;
        if (i + length > step) {
          return true;
        }
      }
    }
    return false;
  }

  startNoteResize(
    event: PointerEvent,
    rowIndex: number,
    start: number,
    side: 'left' | 'right'
  ): void {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const originStart = start;
    const originLength = this.noteLength(rowIndex, start);
    const total = this.steps().length;
    const lane = (event.currentTarget as HTMLElement).closest('.note-lane') as HTMLElement | null;
    const cell = lane?.querySelector('.note-cell') as HTMLElement | null;
    const stepPx = cell ? cell.getBoundingClientRect().width + 3 : 20;
    const move = (moveEvent: PointerEvent) => {
      let delta = (moveEvent.clientX - startX) / stepPx;
      if (this.snap()) {
        const step = this.snapSteps();
        delta = Math.round(delta / step) * step;
      } else {
        delta = Math.round(delta * 100) / 100;
      }
      let newStart = originStart;
      let length = originLength;
      if (side === 'right') {
        length = Math.max(0.25, Math.min(total - originStart, originLength + delta));
      } else {
        newStart = Math.max(0, Math.min(originStart + originLength - 0.25, originStart + delta));
        length = originLength + (originStart - newStart);
      }
      this.resizeNote.emit({ row: rowIndex, oldStart: originStart, start: newStart, length });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
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
