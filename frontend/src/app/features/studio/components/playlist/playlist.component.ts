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
import { PlaylistClip, PlaylistTrack } from '@features/studio/models/studio.model';

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
  readonly bars = input.required<number>();
  readonly stepsPerBar = input.required<number>();
  readonly playhead = input.required<number>();
  readonly isPlaying = input.required<boolean>();
  readonly fill = input<boolean>(false);
  readonly collapsed = input<boolean>(false);
  readonly maximized = input<boolean>(false);

  readonly toggleClip = output<PlaylistCellEvent>();
  readonly resizeClip = output<ClipResizeEvent>();
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly extendBars = output<void>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  readonly cellWidth = 18;
  readonly headWidth = 168;

  readonly snap = signal(true);
  readonly snapDivision = signal(4);
  readonly snapSteps = computed(() => 4 / this.snapDivision());
  readonly selectedClip = signal<number | null>(null);

  @ViewChild('body') private bodyRef?: ElementRef<HTMLElement>;
  @ViewChild('hscroll') private hscrollRef?: ElementRef<HTMLElement>;

  readonly totalSteps = computed(() => this.bars() * this.stepsPerBar());
  readonly barsArray = computed(() => Array.from({ length: this.bars() }, (_, i) => i));
  readonly laneWidth = computed(() => this.totalSteps() * this.cellWidth);
  readonly contentWidth = computed(() => this.headWidth + this.laneWidth());

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
    const move = (moveEvent: PointerEvent) => {
      let delta = (moveEvent.clientX - startX) / this.cellWidth;
      if (this.snap()) {
        const step = this.snapSteps();
        delta = Math.round(delta / step) * step;
      } else {
        delta = Math.round(delta * 100) / 100;
      }
      let start = originStart;
      let length = originLength;
      if (side === 'right') {
        length = Math.max(0.25, Math.min(total - originStart, originLength + delta));
      } else {
        start = Math.max(0, Math.min(originStart + originLength - 0.25, originStart + delta));
        length = originLength + (originStart - start);
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
