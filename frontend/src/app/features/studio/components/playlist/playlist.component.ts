import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
  readonly collapseToggle = output<void>();
  readonly maximizeToggle = output<void>();
  readonly floatToggle = output<void>();
  readonly headerDrag = output<PointerEvent>();
  readonly closePanel = output<void>();

  readonly cellWidth = 18;
  readonly headWidth = 168;

  readonly totalSteps = computed(() => this.bars() * this.stepsPerBar());
  readonly allSteps = computed(() => Array.from({ length: this.totalSteps() }, (_, i) => i));
  readonly barsArray = computed(() => Array.from({ length: this.bars() }, (_, i) => i));
  readonly laneWidth = computed(() => this.totalSteps() * this.cellWidth);
  readonly contentWidth = computed(() => this.headWidth + this.laneWidth());

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
