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
  Pattern,
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
  readonly pressedNotes = signal<string[]>([]);

  readonly pianoKeyMap: Record<string, string> = {
    z: 'C4', s: 'C#4', x: 'D4', d: 'D#4', c: 'E4', v: 'F4', g: 'F#4', b: 'G4',
    h: 'G#4', n: 'A4', j: 'A#4', m: 'B4', ',': 'C5', l: 'C#5', '.': 'D5',
    ';': 'D#5', '/': 'E5',
    q: 'C5', '2': 'C#5', w: 'D5', '3': 'D#5', e: 'E5', r: 'F5', '5': 'F#5', t: 'G5',
    '6': 'G#5', y: 'A5', '7': 'A#5', u: 'B5', i: 'C6', '9': 'C#6', o: 'D6',
    '0': 'D#6', p: 'E6', '[': 'F6', '=': 'F#6', ']': 'G6'
  };

  readonly patterns = signal<Pattern[]>(this.createPatterns());
  readonly activePattern = computed(() => this.patterns()[this.patternNumber() - 1]);
  readonly channels = computed(() => this.activePattern()?.channels ?? []);
  readonly pianoRows = computed(
    () => this.channels()[this.selectedChannel()]?.notes ?? []
  );
  readonly patternList = computed(() =>
    this.patterns().map((pattern, index) => ({ number: index + 1, name: pattern.name }))
  );

  readonly playlistTracks = signal<PlaylistTrack[]>(this.createPlaylistTracks());
  readonly playlistClips = signal<PlaylistClip[]>(this.createPlaylistClips());
  readonly playlistStep = signal(-1);

  readonly library = signal<LibraryResponse | null>(null);
  readonly libraryLoading = signal(false);
  readonly libraryError = signal('');
  readonly openMessage = signal('');

  readonly panels = signal<PanelStates>({
    channelRack: {
      open: false,
      collapsed: false,
      maximized: false,
      floating: false,
      x: 280,
      y: 190,
      width: 780,
      height: 320
    },
    pianoRoll: {
      open: false,
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
      open: false,
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

  readonly patternName = computed(() => this.activePattern()?.name ?? 'Pattern');
  readonly selected = computed(
    () => this.channels()[this.selectedChannel()] ?? this.channels()[0]
  );

  private clock: ReturnType<typeof setInterval> | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private absoluteStep = 0;
  private nextClipId = 1000;
  private nextPatternId = 100;
  private readonly heldKeys = new Set<string>();

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
    this.absoluteStep = -1;
    this.currentStep.set(-1);
    this.playlistStep.set(-1);
    this.startClock();
    this.advanceStep();
  }

  stop(): void {
    this.isPlaying.set(false);
    this.isRecording.set(false);
    this.currentStep.set(-1);
    this.playlistStep.set(-1);
    this.absoluteStep = -1;
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
    if (this.songMode() === value) {
      return;
    }
    this.songMode.set(value);
    this.absoluteStep = -1;
    this.currentStep.set(-1);
    this.playlistStep.set(-1);
    if (this.isPlaying()) {
      this.startClock();
      this.advanceStep();
    }
  }

  setBrowserTab(tab: BrowserTab): void {
    this.activeBrowserTab.set(tab);
  }

  toggleKeyboardPiano(): void {
    const enabled = !this.keyboardPiano();
    this.keyboardPiano.set(enabled);
    if (!enabled) {
      this.releaseAllKeyboardNotes();
    }
  }

  playKeyboardNote(key: string): void {
    const lowered = key.toLowerCase();
    const label = this.pianoKeyMap[lowered];
    if (!label) {
      return;
    }
    this.heldKeys.add(lowered);
    this.pressedNotes.set(this.resolveHeldNotes());
    const channel = this.selected();
    if (channel) {
      this.engine.playChannelNote(channel.name, channel.volume, label);
    }
  }

  releaseKeyboardNote(key: string): void {
    const lowered = key.toLowerCase();
    if (this.heldKeys.delete(lowered)) {
      this.pressedNotes.set(this.resolveHeldNotes());
    }
  }

  releaseAllKeyboardNotes(): void {
    if (this.heldKeys.size > 0) {
      this.heldKeys.clear();
      this.pressedNotes.set([]);
    }
  }

  private resolveHeldNotes(): string[] {
    return Array.from(this.heldKeys).map(key => this.pianoKeyMap[key]);
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

  setPattern(number: number): void {
    if (number >= 1 && number <= this.patterns().length) {
      this.patternNumber.set(number);
    }
  }

  addPattern(): void {
    const pattern: Pattern = {
      id: this.nextPatternId++,
      name: `Pattern ${this.patterns().length + 1}`,
      channels: this.createChannels(true)
    };
    this.patterns.update(list => [...list, pattern]);
    this.patternNumber.set(this.patterns().length);
  }

  setStep(id: number, step: number, active: boolean): void {
    const channel = this.channels().find(c => c.id === id);
    if (!channel) {
      return;
    }
    const notes = channel.notes.map(row => ({ ...row, notes: row.notes.slice() }));
    const hadNote = notes.some(row => row.notes[step]);
    if (!active) {
      if (!hadNote) {
        return;
      }
      notes.forEach(row => (row.notes[step] = false));
    } else {
      const c5 = notes.find(row => row.label === 'C5');
      if (!c5) {
        return;
      }
      c5.notes[step] = true;
    }
    this.updateChannel(id, { notes, steps: this.syncSteps(notes) });
    if (active) {
      this.playChannelNote(channel, 'C5');
    }
  }

  setNote(rowIndex: number, step: number, active: boolean): void {
    const channel = this.selected();
    const row = channel?.notes[rowIndex];
    if (!channel || !row) {
      return;
    }
    if (row.notes[step] === active) {
      if (active) {
        this.playChannelNote(channel, row.label);
      }
      return;
    }
    const notes = channel.notes.map((item, index) => {
      if (index !== rowIndex) {
        return item;
      }
      const cells = item.notes.slice();
      cells[step] = active;
      return { ...item, notes: cells };
    });
    this.updateChannel(channel.id, { notes, steps: this.syncSteps(notes) });
    if (active) {
      this.playChannelNote(channel, row.label);
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

  setChannelPan(id: number, pan: number): void {
    this.updateChannel(id, { pan: clamp(Number(pan) || 0, 0, 100) });
  }

  setChannelMixer(id: number, mixerChannel: number): void {
    this.updateChannel(id, { mixerChannel: clamp(Math.round(Number(mixerChannel) || 1), 1, 99) });
  }

  openInPianoRoll(index: number): void {
    this.selectedChannel.set(index);
    this.panels.update(states => ({
      ...states,
      pianoRoll: { ...states.pianoRoll, open: true, collapsed: false, maximized: false }
    }));
    this.frontPanel.set('pianoRoll');
  }

  setPlaylistClip(trackId: number, start: number, active: boolean): void {
    const barStart = Math.floor(start / this.stepsPerBar) * this.stepsPerBar;
    const existing = this.playlistClips().find(
      clip => clip.track === trackId && clip.start === barStart
    );
    if (!active) {
      if (existing) {
        this.playlistClips.update(list => list.filter(clip => clip.id !== existing.id));
      }
      return;
    }
    if (existing) {
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
        name: this.patterns()[pattern - 1]?.name ?? `Pattern ${pattern}`,
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
    this.playChannelNote(channel, 'C5');
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
    const pattern = this.activePattern();
    if (!pattern) {
      return;
    }
    this.patterns.update(list =>
      list.map(item =>
        item.id === pattern.id
          ? {
              ...item,
              channels: item.channels.map(channel =>
                channel.id === id ? { ...channel, ...patch } : channel
              )
            }
          : item
      )
    );
  }

  private createPatterns(): Pattern[] {
    return this.patternNames.map((name, index) => ({
      id: index,
      name,
      channels: this.createChannels()
    }));
  }

  private createChannels(empty = false): Channel[] {
    const make = (id: number, name: string, color: string, on: number[] = []): Channel => {
      const active = empty ? [] : on;
      const notes = this.createChannelNotes(active);
      return {
        id,
        name,
        color,
        steps: this.syncSteps(notes),
        notes,
        volume: 78,
        pan: 50,
        mixerChannel: id + 1,
        muted: false,
        solo: false
      };
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

    return labels
      .slice()
      .reverse()
      .map(label => ({
        label,
        black: label.includes('#'),
        notes: Array.from({ length: 16 }, () => false)
      }));
  }

  private createChannelNotes(activeSteps: number[]): PianoRow[] {
    const rows = this.createPianoRows();
    const c5 = rows.find(row => row.label === 'C5');
    if (c5) {
      activeSteps.forEach(step => (c5.notes[step] = true));
    }
    return rows;
  }

  private syncSteps(notes: PianoRow[]): boolean[] {
    return Array.from({ length: this.stepCount }, (_, step) =>
      notes.some(row => row.notes[step])
    );
  }

  private playChannelNote(channel: Channel, label: string): void {
    this.engine.playChannelNote(channel.name, channel.volume, label);
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
    this.clock = setInterval(() => this.advanceStep(), stepMs);
  }

  private advanceStep(): void {
    if (this.songMode()) {
      this.absoluteStep = (this.absoluteStep + 1) % this.playlistTotalSteps;
      this.playlistStep.set(this.absoluteStep);
      this.currentStep.set(this.absoluteStep % this.stepCount);
      this.triggerPlaylistStep(this.absoluteStep);
      return;
    }
    this.absoluteStep = (this.absoluteStep + 1) % this.stepCount;
    this.currentStep.set(this.absoluteStep);
    this.playlistStep.set(-1);
    this.triggerPatternStep(this.activePattern(), this.absoluteStep);
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private triggerPatternStep(pattern: Pattern | undefined, step: number): void {
    if (!pattern) {
      return;
    }
    const anySolo = pattern.channels.some(channel => channel.solo);
    for (const channel of pattern.channels) {
      if (channel.muted || (anySolo && !channel.solo)) {
        continue;
      }
      this.triggerChannelStep(channel, step);
    }
  }

  private triggerPlaylistStep(songStep: number): void {
    const tracks = this.playlistTracks();
    const anySolo = tracks.some(track => track.solo);
    for (const clip of this.playlistClips()) {
      if (songStep < clip.start || songStep >= clip.start + clip.length) {
        continue;
      }
      const track = tracks.find(item => item.id === clip.track);
      if (!track || track.muted || (anySolo && !track.solo)) {
        continue;
      }
      const pattern = this.patterns()[clip.pattern - 1];
      if (!pattern) {
        continue;
      }
      const channel =
        pattern.channels.find(item => item.id === track.id) ?? pattern.channels[0];
      if (!channel || channel.muted) {
        continue;
      }
      const localStep = (songStep - clip.start) % this.stepCount;
      this.triggerChannelStep(channel, localStep);
    }
  }

  private triggerChannelStep(channel: Channel, step: number): void {
    for (const row of channel.notes) {
      if (row.notes[step]) {
        this.playChannelNote(channel, row.label);
      }
    }
  }
}
