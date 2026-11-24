import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { PianoRow } from '@features/studio/models/studio.model';
import { computeColumnWindow, computeRowWindow } from './piano-roll.viewport';

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
export class PianoRollComponent implements AfterViewInit, OnDestroy {
  readonly rows = input.required<PianoRow[]>();
  readonly steps = input.required<number[]>();
  readonly stepsPerBar = input<number>(16);
  readonly currentStep = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly channelName = input.required<string>();
  readonly pressedNotes = input<string[]>([]);
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);

  readonly toggleNote = output<NoteToggleEvent>();
  readonly resizeNote = output<NoteResizeEvent>();
  readonly noteOn = output<string>();
  readonly noteOff = output<string>();
  readonly extendBars = output<void>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  @ViewChild('body') private body?: ElementRef<HTMLElement>;
  @ViewChild('hscroll') private hscrollRef?: ElementRef<HTMLElement>;

  private readonly zone = inject(NgZone);
  readonly rowHeight = 22;
  private readonly rulerHeight = 24;
  private readonly overscanSteps = 8;
  private readonly windowChunk = 8;
  private readonly overscanRows = 6;
  private readonly rowChunk = 12;
  private activePointerNote: string | null = null;
  private lastExtend = 0;
  private resizeObserver?: ResizeObserver;
  private scrollRaf = 0;

  readonly cellWidth = 18;
  readonly cellGap = 3;
  readonly stepWidth = this.cellWidth + this.cellGap;
  readonly keyWidth = 45;
  readonly laneWidth = computed(
    () => this.steps().length * this.stepWidth - this.cellGap
  );
  readonly contentWidth = computed(() => this.keyWidth + this.laneWidth());

  // Only the columns near the viewport are rendered, so scrolling further and
  // further right does not grow the DOM without bound.
  readonly visibleStart = signal(0);
  readonly visibleEnd = signal(Number.MAX_SAFE_INTEGER);
  readonly visibleSteps = computed(() => {
    const steps = this.steps();
    const start = Math.max(0, Math.min(this.visibleStart(), steps.length));
    const end = Math.max(start, Math.min(this.visibleEnd(), steps.length));
    return steps.slice(start, end);
  });

  // Rows are virtualized too: with 128 pitches the full grid would otherwise
  // paint thousands of cells on every scroll frame.
  readonly visibleRowStart = signal(0);
  readonly visibleRowEnd = signal(48);
  readonly visibleRows = computed(() => {
    const rows = this.rows();
    const start = Math.max(0, Math.min(this.visibleRowStart(), rows.length));
    const end = Math.max(start, Math.min(this.visibleRowEnd(), rows.length));
    return rows
      .slice(start, end)
      .map((row, offset) => ({ row, index: start + offset }));
  });
  readonly topSpacerHeight = computed(() => {
    const total = this.rows().length;
    const start = Math.max(0, Math.min(this.visibleRowStart(), total));
    return start * this.rowHeight;
  });
  readonly bottomSpacerHeight = computed(() => {
    const total = this.rows().length;
    const end = Math.max(0, Math.min(this.visibleRowEnd(), total));
    return Math.max(0, total - end) * this.rowHeight;
  });

  readonly coveredCells = computed(() =>
    this.rows().map(row => {
      const covered = new Array<boolean>(this.steps().length).fill(false);
      for (let i = 0; i < row.notes.length; i++) {
        if (!row.notes[i]) {
          continue;
        }
        const length = row.lengths[i] ?? 1;
        const end = Math.min(covered.length, Math.ceil(i + length));
        for (let step = i + 1; step < end; step++) {
          covered[step] = true;
        }
      }
      return covered;
    })
  );

  readonly noteBlocks = computed(() =>
    this.rows().map(row => {
      const blocks: { start: number; length: number }[] = [];
      for (let step = 0; step < row.notes.length; step++) {
        if (row.notes[step]) {
          blocks.push({ start: step, length: row.lengths[step] ?? 1 });
        }
      }
      return blocks;
    })
  );
  readonly barIndexes = computed(() => {
    const perBar = Math.max(1, this.stepsPerBar());
    return Array.from(
      { length: Math.ceil(this.steps().length / perBar) },
      (_, index) => index
    );
  });

  readonly snap = signal(true);
  readonly snapDivision = signal(4);
  readonly snapSteps = computed(() =>
    Math.max(1, Math.round(this.stepsPerBar() / this.snapDivision()))
  );
  readonly selectedNote = signal<{ row: number; step: number } | null>(null);

  ngAfterViewInit(): void {
    const body = this.body?.nativeElement;
    const hscroll = this.hscrollRef?.nativeElement;
    this.zone.runOutsideAngular(() => {
      body?.addEventListener('scroll', this.handleBodyScroll, { passive: true });
      hscroll?.addEventListener('scroll', this.handleHScroll, { passive: true });
      window.addEventListener('resize', this.handleResize);
      if (body && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
        this.resizeObserver.observe(body);
      }
    });
    setTimeout(() => {
      this.centerOnNote('C5');
      this.updateVisibleWindow(true);
    }, 50);
  }

  ngOnDestroy(): void {
    this.body?.nativeElement.removeEventListener('scroll', this.handleBodyScroll);
    this.hscrollRef?.nativeElement.removeEventListener('scroll', this.handleHScroll);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    if (this.scrollRaf) {
      cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = 0;
    }
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

  onKeyPointerDown(event: PointerEvent, label: string): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.pressKey(label);
  }

  onKeyPointerEnter(event: PointerEvent, label: string): void {
    if ((event.buttons & 1) !== 1) {
      return;
    }
    this.pressKey(label);
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  onPointerRelease(): void {
    this.releaseKey();
  }

  private pressKey(label: string): void {
    if (this.activePointerNote === label) {
      return;
    }
    this.releaseKey();
    this.activePointerNote = label;
    this.noteOn.emit(label);
  }

  private releaseKey(): void {
    if (this.activePointerNote !== null) {
      this.noteOff.emit(this.activePointerNote);
      this.activePointerNote = null;
    }
  }

  private readonly handleBodyScroll = (): void => {
    const body = this.body?.nativeElement;
    const hscroll = this.hscrollRef?.nativeElement;
    if (body && hscroll && Math.abs(hscroll.scrollLeft - body.scrollLeft) > 1) {
      hscroll.scrollLeft = body.scrollLeft;
    }
    this.scheduleUpdate();
  };

  private readonly handleHScroll = (): void => {
    const el = this.hscrollRef?.nativeElement;
    const body = this.body?.nativeElement;
    if (el && body && Math.abs(body.scrollLeft - el.scrollLeft) > 1) {
      body.scrollLeft = el.scrollLeft;
    }
    this.scheduleUpdate();
    if (!el) {
      return;
    }
    if (el.scrollWidth - el.clientWidth - el.scrollLeft > 320) {
      return;
    }
    const now = Date.now();
    if (now - this.lastExtend < 400) {
      return;
    }
    this.lastExtend = now;
    this.zone.run(() => this.extendBars.emit());
  };

  private readonly handleResize = (): void => this.scheduleUpdate();

  // Coalesce every scroll event into a single frame so the window math and the
  // resulting change detection run at most once per paint.
  private scheduleUpdate(): void {
    if (this.scrollRaf) {
      return;
    }
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      this.updateVisibleWindow();
    });
  }

  private updateVisibleWindow(force = false): void {
    const body = this.body?.nativeElement;
    if (!body) {
      return;
    }
    const columns = computeColumnWindow({
      scrollLeft: body.scrollLeft,
      viewportWidth: body.clientWidth,
      keyWidth: this.keyWidth,
      stepWidth: this.stepWidth,
      total: this.steps().length,
      overscan: this.overscanSteps,
      chunk: this.windowChunk
    });
    const rows = computeRowWindow({
      scrollTop: body.scrollTop,
      viewportHeight: body.clientHeight,
      rowHeight: this.rowHeight,
      headerHeight: this.rulerHeight,
      total: this.rows().length,
      overscan: this.overscanRows,
      chunk: this.rowChunk
    });
    if (
      !force &&
      columns.start === this.visibleStart() &&
      columns.end === this.visibleEnd() &&
      rows.start === this.visibleRowStart() &&
      rows.end === this.visibleRowEnd()
    ) {
      return;
    }
    this.zone.run(() => {
      this.visibleStart.set(columns.start);
      this.visibleEnd.set(columns.end);
      this.visibleRowStart.set(rows.start);
      this.visibleRowEnd.set(rows.end);
    });
  }

  setSnapDivision(event: Event): void {
    this.snapDivision.set(Number((event.target as HTMLSelectElement).value) || 4);
  }

  onNoteContextMenu(event: MouseEvent, row: number, step: number): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    this.toggleNote.emit({ row, step, active: false });
  }

  onNoteBlockContextMenu(event: MouseEvent, row: number, step: number): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.toggleNote.emit({ row, step, active: false });
  }

  onHandleContextMenu(event: MouseEvent): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    const selected = this.selectedNote();
    if (!selected) {
      return;
    }
    event.preventDefault();
    this.toggleNote.emit({ row: selected.row, step: selected.step, active: false });
    this.selectedNote.set(null);
  }

  noteLength(rowIndex: number, step: number): number {
    return this.rows()[rowIndex]?.lengths[step] ?? 1;
  }

  notesInRow(rowIndex: number): { start: number; length: number }[] {
    return this.noteBlocks()[rowIndex] ?? [];
  }

  isCovered(rowIndex: number, step: number): boolean {
    return this.coveredCells()[rowIndex]?.[step] ?? false;
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
    const stepPx = this.stepWidth;
    const snapStep = this.snap() ? this.snapSteps() : 0;
    const snapValue = (value: number): number => {
      const clamped = Math.max(0, value);
      return snapStep > 0
        ? Math.round(clamped / snapStep) * snapStep
        : Math.round(clamped * 100) / 100;
    };
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / stepPx;
      let newStart = originStart;
      let length = originLength;
      if (side === 'right') {
        const end = snapValue(originStart + originLength + delta);
        length = Math.max(0.25, Math.min(total - originStart, end - originStart));
      } else {
        const end = originStart + originLength;
        newStart = Math.max(0, Math.min(end - 0.25, snapValue(originStart + delta)));
        length = end - newStart;
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
