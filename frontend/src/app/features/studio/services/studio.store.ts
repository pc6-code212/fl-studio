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
  PanelId,
  PanelStates,
  PianoRow,
  PlaylistClip,
  PlaylistTrack
} from '../models/studio.model';

const PANEL_MIN_SIZE: Record<PanelId, { width: number; height: number }> = {
  channelRack: { width: 460, height: 150 },
  pianoRoll: { width: 420, height: 220 },
  playlist: { width: 520, height: 200 },
  mixer: { width: 360, height: 240 }
};

@Injectable({ providedIn: 'root' })
export class StudioStore implements OnDestroy {
  private readonly engine = inject(AudioEngineService);
  private readonly libraryApi = inject(LibraryApiService);

  readonly stepCount = 16;
  readonly steps = Array.from({ length: this.stepCount }, (_, i) => i);
  readonly stepsPerBar = 16;
  readonly playlistBars = 8;
  readonly playlistTotalSteps = this.playlistBars * this.stepsPerBar;
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

  readonly playlistTracks = signal<PlaylistTrack[]>(this.createPlaylistTracks());
  readonly playlistClips = signal<PlaylistClip[]>(this.createPlaylistClips());
  readonly playlistStep = signal(-1);

  readonly library = signal<LibraryResponse | null>(null);
  readonly libraryLoading = signal(false);
  readonly libraryError = signal('');
  readonly openMessage = signal('');

  readonly panels = signal<PanelStates>({
    channelRack: {
      open: true,
      collapsed: false,
      maximized: false,
      floating: false,
      x: 280,
      y: 190,
      width: 780,
      height: 320
    },
    pianoRoll: {
      open: true,
      collapsed: false,
      maximized: false,
      floating: false,
      x: 340,
      y: 250,
      width: 820,
      height: 420
    },
    playlist: {
      open: true,
      collapsed: false,
      maximized: false,
      floating: false,
      x: 320,
      y: 280,
      width: 900,
      height: 360
    },
    mixer: {
      open: true,
      collapsed: false,
      maximized: false,
      floating: false,
      x: 880,
      y: 170,
      width: 560,
      height: 520
    }
  });
  readonly frontPanel = signal<PanelId>('mixer');
  readonly rackHeight = signal(320);
  readonly playlistHeight = signal(240);
  readonly mixerWidth = signal(316);

  readonly patternName = computed(
    () => this.patternNames[(this.patternNumber() - 1) % this.patternNames.length]
  );
  readonly selected = computed(() => this.channels()[this.selectedChannel()]);

  private clock: ReturnType<typeof setInterval> | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private absoluteStep = 0;
  private nextClipId = 1000;

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
    this.absoluteStep = 0;
    this.currentStep.set(-1);
    this.playlistStep.set(-1);
    this.startClock();
  }

  stop(): void {
    this.isPlaying.set(false);
    this.isRecording.set(false);
    this.currentStep.set(-1);
    this.playlistStep.set(-1);
    this.absoluteStep = 0;
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

  togglePanel(id: PanelId): void {
    this.panels.update(states => {
      const current = states[id];
      const visible = current.open && !current.collapsed;
      return {
        ...states,
        [id]: visible
          ? { ...current, open: false, maximized: false }
          : { ...current, open: true, collapsed: false }
      };
    });
  }

  closePanel(id: PanelId): void {
    this.panels.update(states => ({
      ...states,
      [id]: { ...states[id], open: false, maximized: false }
    }));
  }

  togglePanelCollapsed(id: PanelId): void {
    this.panels.update(states => {
      const current = states[id];
      const collapsed = !current.collapsed;
      return {
        ...states,
        [id]: { ...current, open: true, collapsed, maximized: collapsed ? false : current.maximized }
      };
    });
  }

  togglePanelMaximized(id: PanelId): void {
    this.panels.update(states => {
      const maximized = !states[id].maximized;
      const next = {} as PanelStates;
      (Object.keys(states) as PanelId[]).forEach(key => {
        next[key] = { ...states[key], maximized: key === id ? maximized : false };
      });
      next[id] = { ...next[id], open: true, collapsed: false, floating: false };
      return next;
    });
  }

  togglePanelFloating(id: PanelId): void {
    const current = this.panels()[id];
    const floating = !current.floating;
    this.panels.update(states => ({
      ...states,
      [id]: {
        ...states[id],
        open: true,
        collapsed: false,
        maximized: false,
        floating
      }
    }));
    if (floating) {
      this.frontPanel.set(id);
    } else if (this.frontPanel() === id) {
      const other = (Object.keys(this.panels()) as PanelId[]).find(
        key => key !== id && this.panels()[key].floating
      );
      if (other) {
        this.frontPanel.set(other);
      }
    }
  }

  bringPanelToFront(id: PanelId): void {
    if (this.frontPanel() !== id) {
      this.frontPanel.set(id);
    }
  }

  setPanelPosition(id: PanelId, x: number, y: number): void {
    this.panels.update(states => {
      const current = states[id];
      return {
        ...states,
        [id]: {
          ...current,
          x: clamp(Math.round(x), 0, Math.max(0, window.innerWidth - 120)),
          y: clamp(Math.round(y), 30, Math.max(30, window.innerHeight - 60))
        }
      };
    });
  }

  setPanelSize(id: PanelId, width: number, height: number): void {
    const min = PANEL_MIN_SIZE[id];
    this.panels.update(states => ({
      ...states,
      [id]: {
        ...states[id],
        width: clamp(Math.round(width), min.width, window.innerWidth),
        height: clamp(Math.round(height), min.height, window.innerHeight)
      }
    }));
  }

  setRackHeight(height: number): void {
    this.rackHeight.set(clamp(Math.round(height), 120, 620));
  }

  setPlaylistHeight(height: number): void {
    this.playlistHeight.set(clamp(Math.round(height), 120, 620));
  }

  setMixerWidth(width: number): void {
    this.mixerWidth.set(clamp(Math.round(width), 220, 640));
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

  togglePlaylistClip(trackId: number, start: number): void {
    const barStart = Math.floor(start / this.stepsPerBar) * this.stepsPerBar;
    const existing = this.playlistClips().find(
      clip => clip.track === trackId && clip.start === barStart
    );
    if (existing) {
      this.playlistClips.update(list => list.filter(clip => clip.id !== existing.id));
      return;
    }
    const track = this.playlistTracks().find(item => item.id === trackId);
    const pattern = this.patternNumber();
    this.playlistClips.update(list => [
      ...list,
      {
        id: this.nextClipId++,
        track: trackId,
        start: barStart,
        length: this.stepsPerBar,
        pattern,
        name: this.patternNames[(pattern - 1) % this.patternNames.length],
        color: track?.color ?? '#f5a623'
      }
    ]);
  }

  togglePlaylistMute(trackId: number): void {
    this.playlistTracks.update(list =>
      list.map(track => (track.id === trackId ? { ...track, muted: !track.muted } : track))
    );
  }

  togglePlaylistSolo(trackId: number): void {
    this.playlistTracks.update(list =>
      list.map(track => (track.id === trackId ? { ...track, solo: !track.solo } : track))
    );
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
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const labels: string[] = [];
    for (let octave = 0; octave <= 10; octave++) {
      for (const name of noteNames) {
        labels.push(name + octave);
      }
    }

    const rows: PianoRow[] = labels
      .slice()
      .reverse()
      .map(label => ({
        label,
        black: label.includes('#'),
        notes: Array.from({ length: 16 }, () => false)
      }));

    const rowIndex = new Map(rows.map((row, index) => [row.label, index]));
    const melody: Array<[string, number[]]> = [
      ['C5', [0, 4, 8, 12]],
      ['D#5', [2, 6, 10, 14]],
      ['G5', [0, 6, 8]],
      ['C6', [0, 4, 8, 12]],
      ['A#5', [2, 10]],
      ['F5', [6, 14]]
    ];
    melody.forEach(([label, cols]) => {
      const index = rowIndex.get(label);
      if (index === undefined) {
        return;
      }
      cols.forEach(col => (rows[index].notes[col] = true));
    });

    return rows;
  }

  private createPlaylistTracks(): PlaylistTrack[] {
    return this.channels().map(channel => ({
      id: channel.id,
      name: channel.name,
      color: channel.color,
      muted: false,
      solo: false
    }));
  }

  private createPlaylistClips(): PlaylistClip[] {
    const tracks = this.playlistTracks();
    const make = (
      id: number,
      trackIndex: number,
      startBar: number,
      bars: number,
      pattern: number
    ): PlaylistClip => {
      const track = tracks[trackIndex];
      return {
        id,
        track: track.id,
        start: startBar * this.stepsPerBar,
        length: bars * this.stepsPerBar,
        pattern,
        name: this.patternNames[(pattern - 1) % this.patternNames.length],
        color: track.color
      };
    };

    return [
      make(0, 0, 0, 2, 1),
      make(1, 0, 2, 2, 2),
      make(2, 0, 4, 2, 3),
      make(3, 0, 6, 2, 4),
      make(4, 1, 2, 2, 2),
      make(5, 1, 6, 2, 4),
      make(6, 2, 1, 1, 1),
      make(7, 2, 3, 2, 2),
      make(8, 2, 5, 1, 3),
      make(9, 2, 6, 2, 4),
      make(10, 3, 4, 2, 3),
      make(11, 3, 6, 2, 4),
      make(12, 4, 0, 4, 1),
      make(13, 4, 6, 2, 4),
      make(14, 5, 2, 2, 2),
      make(15, 5, 5, 1, 3),
      make(16, 5, 6, 2, 4),
      make(17, 6, 0, 2, 1),
      make(18, 6, 4, 4, 3),
      make(19, 7, 4, 1, 3),
      make(20, 7, 6, 2, 4)
    ];
  }

  private startClock(): void {
    this.stopClock();
    const stepMs = 60000 / this.bpm() / 4;
    this.clock = setInterval(() => {
      this.absoluteStep = (this.absoluteStep + 1) % this.playlistTotalSteps;
      this.playlistStep.set(this.absoluteStep);
      const next = this.absoluteStep % this.stepCount;
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
