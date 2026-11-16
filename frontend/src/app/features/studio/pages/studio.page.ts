import { ChangeDetectionStrategy, Component, HostListener, OnInit, inject } from '@angular/core';
import { BrowserPanelComponent } from '@features/studio/components/browser-panel/browser-panel.component';
import { ChannelRackComponent } from '@features/studio/components/channel-rack/channel-rack.component';
import { MixerPanelComponent } from '@features/studio/components/mixer-panel/mixer-panel.component';
import { PianoRollComponent } from '@features/studio/components/piano-roll/piano-roll.component';
import { StatusBarComponent } from '@features/studio/components/status-bar/status-bar.component';
import { ToolbarComponent } from '@features/studio/components/toolbar/toolbar.component';
import { StudioStore } from '@features/studio/services/studio.store';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [
    ToolbarComponent,
    BrowserPanelComponent,
    ChannelRackComponent,
    PianoRollComponent,
    MixerPanelComponent,
    StatusBarComponent
  ],
  templateUrl: './studio.page.html',
  styleUrl: './studio.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudioPage implements OnInit {
  readonly store = inject(StudioStore);

  ngOnInit(): void {
    this.store.loadLibrary();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
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
}
