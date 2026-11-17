import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  input,
  output
} from '@angular/core';
import { PlaylistClip, PlaylistTrack } from '@features/studio/models/studio.model';

export interface PlaylistCellEvent {
  track: number;
  start: number;
  active: boolean;
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
  readonly toggleMute = output<number>();
  readonly toggleSolo = output<number>();
  readonly extendBars = output<void>();
  readonly extendTracks = output<void>();
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  readonly cellWidth = 18;
  readonly headWidth = 168;

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
    if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      this.extendTracks.emit();
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
}
