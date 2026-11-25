import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import {
  PlaylistClip,
  PlaylistClipNote,
  PlaylistTrack
} from '@features/studio/models/studio.model';

export interface PlaylistCellEvent {
  track: number;
  start: number;
  active: boolean;
}

export interface ClipResizeEvent {
  id: number;
  start: number;
  length: number;
}

interface ClipNoteBlock {
  left: number;
  width: number;
  top: number;
  height: number;
}

@Component({
  selector: 'app-playlist',
  standalone: true,
  templateUrl: './playlist.component.html',
  styleUrl: './playlist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaylistComponent {
  readonly tracks = input.required<PlaylistTrack[]>();
  readonly clips = input.required<PlaylistClip[]>();
  readonly clipNotes = input<Record<number, PlaylistClipNote[]>>({});
  readonly patternLength = input<number>(16);
  readonly bars = input.required<number>();
  readonly stepsPerBar = input.required<number>();
  readonly playhead = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly fill = input<boolean>(false);
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);
  readonly floating = input<boolean>(false);

  readonly toggleClip = output<PlaylistCellEvent>();
  readonly openClip = output<PlaylistClip>();
  readonly resizeClip = output<ClipResizeEvent>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly extendBars = output<void>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  // 6px per fine step keeps a bar about as wide as before now that a bar is split
  // into 48 (stepsPerBar) pieces.
  readonly cellWidth = 6;
  readonly headWidth = 168;
  private readonly octaveRows = 12;

  readonly snap = signal(true);
  readonly snapDivision = signal(4);
  readonly snapOptions = [
    { value: 1, label: 'Bar' },
    { value: 4, label: '1/4 bar · Beat' },
    { value: 8, label: '1/2 beat' },
    { value: 12, label: '1/3 beat' },
    { value: 16, label: '1/4 beat' },
    { value: 24, label: '1/6 beat' }
  ] as const;
  readonly snapSteps = computed(() =>
    Math.max(1, Math.round(this.stepsPerBar() / this.snapDivision()))
  );
  readonly selectedClip = signal<number | null>(null);

  @ViewChild('body') private bodyRef?: ElementRef<HTMLElement>;
  @ViewChild('hscroll') private hscrollRef?: ElementRef<HTMLElement>;

  readonly totalSteps = computed(() => this.bars() * this.stepsPerBar());
  readonly barsArray = computed(() => Array.from({ length: this.bars() }, (_, i) => i));
  readonly laneWidth = computed(() => this.totalSteps() * this.cellWidth);
  readonly contentWidth = computed(() => this.headWidth + this.laneWidth());
  readonly clipBlocks = computed<Record<number, ClipNoteBlock[]>>(() => {
    const source = this.clipNotes();
    const patternLength = Math.max(1, this.patternLength());
    const result: Record<number, ClipNoteBlock[]> = {};
    for (const clip of this.clips()) {
      const notes = source[clip.id] ?? [];
      if (notes.length === 0) {
        result[clip.id] = [];
        continue;
      }
      let minRow = Infinity;
      let maxRow = -Infinity;
      for (const note of notes) {
        minRow = Math.min(minRow, note.row);
        maxRow = Math.max(maxRow, note.row);
      }
      const span = Math.max(this.octaveRows, maxRow - minRow + 1);
      const blocks: ClipNoteBlock[] = [];
      const repeats = Math.max(1, Math.ceil(clip.length / patternLength));
      for (let repeat = 0; repeat < repeats; repeat++) {
        for (const note of notes) {
          const offset = repeat * patternLength + note.step;
          if (offset >= clip.length) {
            continue;
          }
          const length = Math.min(note.length, clip.length - offset);
          blocks.push({
            left: (offset / clip.length) * 100,
            width: (length / clip.length) * 100,
            top: ((note.row - minRow) / span) * 100,
            height: 100 / span
          });
        }
      }
      result[clip.id] = blocks;
    }
    return result;
  });

  onLaneClick(event: MouseEvent, trackId: number, active: boolean): void {
    const lane = event.currentTarget as HTMLElement;
    const x = event.clientX - lane.getBoundingClientRect().left;
    const step = Math.max(
      0,
      Math.min(this.totalSteps() - 1, Math.floor(x / this.cellWidth))
    );
    this.toggleClip.emit({ track: trackId, start: step, active });
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const hscroll = this.hscrollRef?.nativeElement;
    if (hscroll && Math.abs(hscroll.scrollLeft - el.scrollLeft) > 1) {
      hscroll.scrollLeft = el.scrollLeft;
    }
  }

  onHorizontalScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const body = this.bodyRef?.nativeElement;
    if (body && Math.abs(body.scrollLeft - el.scrollLeft) > 1) {
      body.scrollLeft = el.scrollLeft;
    }
    if (el.scrollWidth > el.clientWidth + 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 48) {
      this.extendBars.emit();
    }
  }

  clipsFor(trackId: number): PlaylistClip[] {
    return this.clips().filter(clip => clip.track === trackId);
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

  setSnapDivision(event: Event): void {
    this.snapDivision.set(Number((event.target as HTMLSelectElement).value) || 4);
  }

  onLaneContextMenu(event: MouseEvent, trackId: number): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    this.onLaneClick(event, trackId, false);
  }

  onClipContextMenu(event: MouseEvent, trackId: number, start: number): void {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.toggleClip.emit({ track: trackId, start, active: false });
  }

  onClipHandleContextMenu(event: MouseEvent): void {
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
    const id = this.selectedClip();
    if (id === null) {
      return;
    }
    const clip = this.clips().find(item => item.id === id);
    if (!clip) {
      this.selectedClip.set(null);
      return;
    }
    event.preventDefault();
    this.toggleClip.emit({ track: clip.track, start: clip.start, active: false });
    this.selectedClip.set(null);
  }

  startClipResize(event: PointerEvent, clip: PlaylistClip, side: 'left' | 'right'): void {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const originStart = clip.start;
    const originLength = clip.length;
    const total = this.totalSteps();
    const snapStep = this.snap() ? this.snapSteps() : 0;
    const snapValue = (value: number): number => {
      const clamped = Math.max(0, value);
      return snapStep > 0
        ? Math.round(clamped / snapStep) * snapStep
        : Math.round(clamped * 100) / 100;
    };
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / this.cellWidth;
      let start = originStart;
      let length = originLength;
      if (side === 'right') {
        const end = snapValue(originStart + originLength + delta);
        length = Math.max(0.25, Math.min(total - originStart, end - originStart));
      } else {
        const end = originStart + originLength;
        start = Math.max(0, Math.min(end - 0.25, snapValue(originStart + delta)));
        length = end - start;
      }
      this.resizeClip.emit({ id: clip.id, start, length });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }
}
