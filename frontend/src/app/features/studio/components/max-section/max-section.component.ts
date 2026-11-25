import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  inject,
  input,
  output
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PanelId } from '@features/studio/models/studio.model';
import { StudioStore } from '@features/studio/services/studio.store';

@Component({
  selector: 'app-max-section',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './max-section.component.html',
  styleUrl: './max-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaxSectionComponent {
  readonly channelRackTemplate = input.required<TemplateRef<unknown>>();
  readonly pianoRollTemplate = input.required<TemplateRef<unknown>>();
  readonly playlistTemplate = input.required<TemplateRef<unknown>>();

  readonly rackResizeStart = output<PointerEvent>();
  readonly playlistResizeStart = output<PointerEvent>();
  readonly panelResizeStart = output<{ id: PanelId; event: PointerEvent }>();

  readonly store = inject(StudioStore);

  readonly showRackSplitter = computed(() => {
    const panels = this.store.panels();
    return (
      panels.channelRack.open &&
      panels.pianoRoll.open &&
      !panels.channelRack.collapsed &&
      !panels.channelRack.maximized &&
      !panels.channelRack.floating &&
      !panels.pianoRoll.maximized &&
      !panels.pianoRoll.floating
    );
  });

  readonly showPlaylistSplitter = computed(() => {
    const panels = this.store.panels();
    return (
      panels.playlist.open &&
      panels.pianoRoll.open &&
      !panels.playlist.collapsed &&
      !panels.playlist.maximized &&
      !panels.playlist.floating &&
      !panels.pianoRoll.collapsed &&
      !panels.pianoRoll.maximized &&
      !panels.pianoRoll.floating
    );
  });
}
