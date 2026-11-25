import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BrowserPanelComponent } from '@features/studio/components/browser-panel/browser-panel.component';
import { ChannelRackComponent } from '@features/studio/components/channel-rack/channel-rack.component';
import { MaxSectionComponent } from '@features/studio/components/max-section/max-section.component';
import { MixerPanelComponent } from '@features/studio/components/mixer-panel/mixer-panel.component';
import { PianoRollComponent } from '@features/studio/components/piano-roll/piano-roll.component';
import { PlaylistComponent } from '@features/studio/components/playlist/playlist.component';
import { StatusBarComponent } from '@features/studio/components/status-bar/status-bar.component';
import { ToolbarComponent } from '@features/studio/components/toolbar/toolbar.component';
import { PanelId } from '@features/studio/models/studio.model';
import { StudioStore } from '@features/studio/services/studio.store';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [
    ToolbarComponent,
    BrowserPanelComponent,
    MaxSectionComponent,
    ChannelRackComponent,
    PianoRollComponent,
    PlaylistComponent,
    MixerPanelComponent,
    StatusBarComponent,
    NgTemplateOutlet
  ],
  templateUrl: './studio.page.html',
  styleUrl: './studio.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioPage implements OnInit {
  readonly store = inject(StudioStore);

  readonly workspaceColumns = computed(() => {
    const mixer = this.store.panels().mixer;
    return mixer.open && !mixer.maximized && !mixer.floating
      ? `212px minmax(0, 1fr) 6px ${this.store.mixerWidth()}px`
      : '212px minmax(0, 1fr)';
  });

  readonly maximizedPanel = computed<PanelId | null>(() => {
    const panels = this.store.panels();
    return (
      (Object.keys(panels) as PanelId[]).find(id => panels[id].maximized) ?? null
    );
  });

  ngOnInit(): void {
    this.store.loadLibrary();
  }

  onRackResizeStart(event: PointerEvent): void {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = this.store.rackHeight();
    const move = (moveEvent: PointerEvent) =>
      this.store.setRackHeight(startHeight + moveEvent.clientY - startY);
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  onPlaylistResizeStart(event: PointerEvent): void {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = this.store.playlistHeight();
    const move = (moveEvent: PointerEvent) =>
      this.store.setPlaylistHeight(startHeight - (moveEvent.clientY - startY));
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  onMixerResizeStart(event: PointerEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.store.mixerWidth();
    const move = (moveEvent: PointerEvent) =>
      this.store.setMixerWidth(startWidth - (moveEvent.clientX - startX));
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  onPanelDragStart(id: PanelId, event: PointerEvent): void {
    const panel = this.store.panels()[id];
    this.store.bringPanelToFront(id);
    if (!panel.floating) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = panel.x;
    const originY = panel.y;
    const move = (moveEvent: PointerEvent) =>
      this.store.setPanelPosition(
        id,
        originX + moveEvent.clientX - startX,
        originY + moveEvent.clientY - startY
      );
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  onPanelResizeStart(id: PanelId, event: Event): void {
    const pointer = event as PointerEvent;
    const panel = this.store.panels()[id];
    event.preventDefault();
    const startX = pointer.clientX;
    const startY = pointer.clientY;
    const startWidth = panel.width;
    const startHeight = panel.height;
    const move = (moveEvent: PointerEvent) =>
      this.store.setPanelSize(
        id,
        startWidth + moveEvent.clientX - startX,
        startHeight + moveEvent.clientY - startY
      );
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;

    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          this.store.redo();
        } else {
          this.store.undo();
        }
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        this.store.redo();
        return;
      }
    }
    const isFormField =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    if (event.code === 'Space') {
      if (isFormField || (target && target.tagName === 'BUTTON')) {
        return;
      }
      event.preventDefault();
      this.store.togglePlay();
      return;
    }

    if (!this.store.keyboardPiano() || isFormField || event.repeat) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key in this.store.pianoKeyMap) {
      event.preventDefault();
      this.store.playKeyboardNote(key);
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyup(event: KeyboardEvent): void {
    if (!this.store.keyboardPiano()) {
      return;
    }
    this.store.releaseKeyboardNote(event.key);
  }

  @HostListener('window:blur')
  handleWindowBlur(): void {
    this.store.releaseAllKeyboardNotes();
  }
}
