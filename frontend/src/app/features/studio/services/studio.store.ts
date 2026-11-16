import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { AudioEngineService } from '@core/services/audio-engine.service';
import { LibraryApiService, LibraryFolder } from '@core/services/library-api.service';
import { clamp } from '@shared/utils/format';
import { mapLibraryResponse } from '../mappers/library.mapper';
import {
  BrowserSection,
  BrowserTab,
  Channel,
  LibraryNode,
  LibraryResponse,
  PianoRow
} from '../models/studio.model';

@Injectable({ providedIn: 'root' })
export class StudioStore implements OnDestroy {
  private readonly engine = inject(AudioEngineService);
  private readonly libraryApi = inject(LibraryApiService);

  readonly stepCount = 16;
  readonly steps = Array.from({ length: this.stepCount }, (_, i) => i);
  readonly patternNames = ['Intro', 'Verse', 'Build', 'Drop', 'Break', 'Outro', 'Fill', 'Idea'];
  readonly browserSections: BrowserSection[] = [
    { title: 'Packs', items: ['Kicks', 'Snares', 'Claps', 'Hats', 'Percussion', 'Bass', 'Synths', 'FX'] },
    { title: 'Channel presets', items: ['3xOsc', 'FLEX', 'Sytrus', 'Sakura', 'Drumaxx', 'Slicex'] },
    { title: 'Mixer presets', items: ['Vocal chain', 'Drum bus', 'Master glue', 'Reverb send'] },
    { title: 'Projects', items: ['New project', 'Demo track', 'Template'] }
  ];

  readonly bpm = signal(140);
  readonly swing = signal(0);
  readonly masterVolume = signal(82);
  readonly isPlaying = signal(false);
  readonly isRecording = signal(false);
  readonly songMode = signal(false);
  readonly currentStep = signal(-1);
  readonly selectedChannel = signal(0);
  readonly patternNumber = signal(1);
  readonly activeBrowserTab = signal<BrowserTab>('packs');
  readonly keyboardPiano = signal(true);

  readonly pianoKeyMap: Record<string, string> = {
    z: 'C4', s: 'C#4', x: 'D4', d: 'D#4', c: 'E4', v: 'F4', g: 'F#4', b: 'G4', h: 'G#4', n: 'A4', j: 'A#4', m: 'B4',
    q: 'C5', '2': 'C#5', w: 'D5', '3': 'D#5', e: 'E5', r: 'F5', '5': 'F#5', t: 'G5', '6': 'G#5', y: 'A5', '7': 'A#5', u: 'B5'
  };

  readonly channels = signal<Channel[]>(this.createChannels());
  readonly pianoRows = signal<PianoRow[]>(this.createPianoRows());

  readonly library = signal<LibraryResponse | null>(null);
  readonly libraryLoading = signal(false);
  readonly libraryError = signal('');
  readonly openMessage = signal('');

  readonly patternName = computed(
    () => this.patternNames[(this.patternNumber() - 1) % this.patternNames.length]
  );
  readonly selected = computed(() => this.channels()[this.selectedChannel()]);

  private clock: ReturnType<typeof setInterval> | null = null;
  private previewAudio: HTMLAudioElement | null = null;

  ngOnDestroy(): void {
    this.stopClock();
    this.stopPreview();
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.stop();
      return;
    }
    this.isPlaying.set(true);
    this.currentStep.set(-1);
    this.startClock();
  }

  stop(): void {
    this.isPlaying.set(false);
    this.isRecording.set(false);
    this.currentStep.set(-1);
    this.stopClock();
  }

  toggleRecord(): void {
    this.isRecording.update(value => !value);
    if (this.isRecording() && !this.isPlaying()) {
      this.togglePlay();
    }
  }

  setBpm(value: number): void {
    this.bpm.set(clamp(Number(value) || 140, 20, 300));
    if (this.isPlaying()) {
      this.startClock();
    }
  }

  setSwing(value: number): void {
    this.swing.set(clamp(Number(value) || 0, 0, 100));
  }

  setMasterVolume(value: number): void {
    const volume = clamp(Number(value) || 0, 0, 100);
    this.masterVolume.set(volume);
    this.engine.setMasterVolume(volume);
  }

  setSongMode(value: boolean): void {
    this.songMode.set(value);
  }

  setBrowserTab(tab: BrowserTab): void {
    this.activeBrowserTab.set(tab);
  }

  toggleKeyboardPiano(): void {
    this.keyboardPiano.update(enabled => !enabled);
  }

  playKeyboardNote(key: string): void {
    const label = this.pianoKeyMap[key.toLowerCase()];
    if (label) {
      this.engine.playPianoNote(label);
    }
  }

  selectChannel(index: number): void {
    this.selectedChannel.set(index);
  }

  prevPattern(): void {
    this.patternNumber.update(n => (n <= 1 ? 8 : n - 1));
  }

  nextPattern(): void {
    this.patternNumber.update(n => (n >= 8 ? 1 : n + 1));
  }

  toggleStep(id: number, step: number): void {
    const channel = this.channels().find(c => c.id === id);
    if (!channel) {
      return;
    }
    const steps = channel.steps.slice();
    steps[step] = !steps[step];
    this.updateChannel(id, { steps });
    if (steps[step]) {
      this.engine.playVoice(channel.name, channel.volume, step);
    }
  }

  toggleNote(rowIndex: number, step: number): void {
    const rows = this.pianoRows().map((row, index) => {
      if (index !== rowIndex) {
        return row;
      }
      const notes = row.notes.slice();
      notes[step] = !notes[step];
      return { ...row, notes };
    });
    this.pianoRows.set(rows);
    if (rows[rowIndex].notes[step]) {
      this.engine.playPianoNote(rows[rowIndex].label);
    }
  }

  toggleMute(id: number): void {
    const channel = this.channels().find(c => c.id === id);
    if (channel) {
      this.updateChannel(id, { muted: !channel.muted });
    }
  }

  toggleSolo(id: number): void {
    const channel = this.channels().find(c => c.id === id);
    if (channel) {
      this.updateChannel(id, { solo: !channel.solo });
    }
  }

  setChannelVolume(id: number, volume: number): void {
    this.updateChannel(id, { volume: clamp(Number(volume) || 0, 0, 100) });
  }

  previewChannel(channel: Channel): void {
    this.engine.playVoice(channel.name, channel.volume, 0);
  }

  loadLibrary(): void {
    this.libraryLoading.set(true);
    this.libraryError.set('');
    this.libraryApi.getLibrary().subscribe({
      next: dto => {
        this.library.set(mapLibraryResponse(dto));
        this.libraryLoading.set(false);
      },
      error: () => {
        this.libraryError.set('Backend offline - start Flask on :5000');
        this.libraryLoading.set(false);
      }
    });
  }

  openFolder(folder: LibraryFolder): void {
    this.libraryApi.openFolder(folder).subscribe({
      next: res => this.openMessage.set(res.opened ? 'Opened ' + res.opened : ''),
      error: () => this.openMessage.set('Could not open folder')
    });
  }

  previewFile(node: LibraryNode): void {
    const ext = (node.name.split('.').pop() || '').toLowerCase();
    if (!['wav', 'mp3', 'ogg', 'aif', 'aiff', 'flac', 'm4a'].includes(ext)) {
      return;
    }
    this.stopPreview();
    const audio = new Audio(this.libraryApi.fileUrl(node.path));
    audio.volume = Math.min(1, Math.pow(this.masterVolume() / 100, 1.5) + 0.1);
    audio.play().catch(() => this.libraryError.set('Could not play ' + node.name));
    this.previewAudio = audio;
  }

  stopPreview(): void {
    if (this.previewAudio) {
      this.previewAudio.pause();
      this.previewAudio = null;
    }
  }

  private updateChannel(id: number, patch: Partial<Channel>): void {
    this.channels.update(list =>
      list.map(channel => (channel.id === id ? { ...channel, ...patch } : channel))
    );
  }

  private createChannels(): Channel[] {
    const make = (id: number, name: string, color: string, on: number[] = []): Channel => {
      const steps = Array.from({ length: 16 }, () => false);
      on.forEach(step => (steps[step] = true));
      return { id, name, color, steps, volume: 78, pan: 50, muted: false, solo: false };
    };

    return [
      make(0, 'Kick', '#e2574c', [0, 4, 8, 12]),
      make(1, 'Clap', '#e08a3c', [4, 12]),
      make(2, 'Hat', '#d8c049', [0, 2, 4, 6, 8, 10, 12, 14]),
      make(3, 'Snare', '#8bbf4a', [7, 15]),
      make(4, '808 Bass', '#42a5a0', [0, 6, 10]),
      make(5, 'Lead', '#4a7fd0', [0, 3, 6, 8, 11, 14]),
      make(6, 'Pad', '#8557c9', [0, 8]),
      make(7, 'FX Riser', '#c057a8', [])
    ];
  }

  private createPianoRows(): PianoRow[] {
    const labels = ['C6', 'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5'];
    const rows = labels.map(label => ({
      label,
      black: label.includes('#'),
      notes: Array.from({ length: 16 }, () => false)
    }));

    const melody: Array<[number, number[]]> = [
      [0, [0, 4, 8, 12]],
      [2, [2, 6, 10, 14]],
      [4, [0, 6, 8]],
      [7, [0, 4, 8, 12]],
      [9, [2, 10]],
      [11, [6, 14]]
    ];
    melody.forEach(([rowIndex, cols]) => {
      cols.forEach(col => (rows[rowIndex].notes[col] = true));
    });

    return rows;
  }

  private startClock(): void {
    this.stopClock();
    const stepMs = 60000 / this.bpm() / 4;
    this.clock = setInterval(() => {
      const next = (this.currentStep() + 1) % this.stepCount;
      this.currentStep.set(next);
      this.triggerStep(next);
    }, stepMs);
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private triggerStep(step: number): void {
    const anySolo = this.channels().some(channel => channel.solo);
    for (const channel of this.channels()) {
      if (channel.steps[step] && !channel.muted && (!anySolo || channel.solo)) {
        this.engine.playVoice(channel.name, channel.volume, step);
      }
    }
    for (const row of this.pianoRows()) {
      if (row.notes[step]) {
        this.engine.playPianoNote(row.label);
      }
    }
  }
}
