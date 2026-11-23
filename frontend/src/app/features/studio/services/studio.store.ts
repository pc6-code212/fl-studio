import { Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
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
  PlaylistClipNote,
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
  readonly pianoRollBars = signal(4);
  readonly pianoRollTotalSteps = computed(() => this.pianoRollBars() * this.stepsPerBar);
  readonly pianoRollSteps = computed(() =>
    Array.from({ length: this.pianoRollTotalSteps() }, (_, i) => i)
  );
  readonly playlistBars = signal(64);
  readonly playlistTotalSteps = computed(() => this.playlistBars() * this.stepsPerBar);
  readonly playlistPalette = [
    '#e2574c', '#e08a3c', '#d8c049', '#8bbf4a', '#42a5a0', '#4a7fd0',
    '#8557c9', '#c057a8', '#d06a8c', '#b08a3c', '#7bc44a', '#3ac4a0',
    '#3aa0c4', '#5a7fd0', '#8557c9', '#c057a8', '#d0684a', '#c9a03c',
    '#6abf6a', '#4aa8a0'
  ];
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
  readonly channelStep = computed(() =>
    this.currentStep() < 0 ? -1 : this.currentStep() % this.stepCount
  );
  readonly selectedChannel = signal(0);
  readonly patternNumber = signal(1);
  readonly activeBrowserTab = signal<BrowserTab>('packs');
  readonly keyboardPiano = signal(true);
  readonly pressedNotes = signal<string[]>([]);
  readonly mousePressedNotes = signal<string[]>([]);
  readonly activeNotes = computed(() =>
    Array.from(new Set([...this.pressedNotes(), ...this.mousePressedNotes()]))
  );

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
  readonly playlistClipNotes = computed<Record<number, PlaylistClipNote[]>>(() => {
    const result: Record<number, PlaylistClipNote[]> = {};
    for (const clip of this.playlistClips()) {
      const channel = this.resolveClipChannel(clip);
      if (!channel) {
        result[clip.id] = [];
        continue;
      }
      const notes: PlaylistClipNote[] = [];
      channel.notes.forEach((row, rowIndex) => {
        for (let step = 0; step < this.pianoRollTotalSteps(); step++) {
          if (row.notes[step]) {
            notes.push({ row: rowIndex, step, length: row.lengths[step] ?? 1 });
          }
        }
      });
      result[clip.id] = notes;
    }
    return result;
  });

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
  readonly centerPanel = signal<PanelId>('playlist');
  readonly rackHeight = signal(320);
  readonly playlistHeight = signal(240);
  readonly mixerWidth = signal(316);

  readonly patternName = computed(() => this.activePattern()?.name ?? 'Pattern');
  readonly selected = computed(
    () => this.channels()[this.selectedChannel()] ?? this.channels()[0]
  );

  private clock: ReturnType<typeof setInterval> | null = null;
  private previewAudio: HTMLAudioElement | null = null;
  private lastSnapshot: string | null = null;
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  private isRestoring = false;
  private readonly undoStack = signal<string[]>([]);
  private readonly redoStack = signal<string[]>([]);
  private absoluteStep = 0;
  private nextClipId = 1000;
  private nextPatternId = 100;
  private readonly heldKeys = new Set<string>();

  constructor() {
    effect(
      () => {
        const snapshot = this.serializeHistoryState();
        if (this.lastSnapshot === null) {
          this.lastSnapshot = snapshot;
          return;
        }
        if (this.isRestoring) {
          this.lastSnapshot = snapshot;
          return;
        }
        if (snapshot === this.lastSnapshot) {
          return;
        }
        if (this.historyTimer !== null) {
          clearTimeout(this.historyTimer);
        }
        this.historyTimer = setTimeout(() => {
          this.historyTimer = null;
          this.commitHistory();
        }, 180);
      },
      { allowSignalWrites: true }
    );
  }

  ngOnDestroy(): void {
    this.stopClock();
    this.stopPreview();
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
  }

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  private commitHistory(): void {
    if (this.isRestoring || this.lastSnapshot === null) {
      return;
    }
    const snapshot = this.serializeHistoryState();
    if (snapshot === this.lastSnapshot) {
      return;
    }
    const previous = this.lastSnapshot;
    this.lastSnapshot = snapshot;
    this.undoStack.update(stack => [...stack, previous]);
    this.redoStack.set([]);
  }

  private flushHistory(): void {
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    this.commitHistory();
  }

  undo(): void {
    this.flushHistory();
    const stack = this.undoStack();
    if (stack.length === 0) {
      return;
    }
    const previous = stack[stack.length - 1];
    this.undoStack.update(items => items.slice(0, -1));
    this.redoStack.update(items => [...items, this.serializeHistoryState()]);
    this.applyHistoryState(previous);
  }

  redo(): void {
    this.flushHistory();
    const stack = this.redoStack();
    if (stack.length === 0) {
      return;
    }
    const next = stack[stack.length - 1];
    this.redoStack.update(items => items.slice(0, -1));
    this.undoStack.update(items => [...items, this.serializeHistoryState()]);
    this.applyHistoryState(next);
  }

  private applyHistoryState(snapshot: string): void {
    this.isRestoring = true;
    this.restoreHistoryState(JSON.parse(snapshot));
    this.lastSnapshot = this.serializeHistoryState();
    queueMicrotask(() => {
      this.isRestoring = false;
    });
  }

  private serializeHistoryState(): string {
    return JSON.stringify({
      bpm: this.bpm(),
      swing: this.swing(),
      masterVolume: this.masterVolume(),
      songMode: this.songMode(),
      selectedChannel: this.selectedChannel(),
      patternNumber: this.patternNumber(),
      keyboardPiano: this.keyboardPiano(),
      playlistBars: this.playlistBars(),
      patterns: this.patterns(),
      playlistTracks: this.playlistTracks(),
      playlistClips: this.playlistClips()
    });
  }

  private restoreHistoryState(state: any): void {
    this.bpm.set(state.bpm);
    this.swing.set(state.swing);
    this.masterVolume.set(state.masterVolume);
    this.engine.setMasterVolume(state.masterVolume);
    this.songMode.set(!!state.songMode);
    this.selectedChannel.set(state.selectedChannel);
    this.patternNumber.set(state.patternNumber);
    this.keyboardPiano.set(state.keyboardPiano);
    this.playlistBars.set(state.playlistBars);
    this.patterns.set(state.patterns);
    this.playlistTracks.set(state.playlistTracks);
    this.playlistClips.set(state.playlistClips);
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

  pressNote(label: string): void {
    this.mousePressedNotes.update(notes =>
      notes.includes(label) ? notes : [...notes, label]
    );
    const channel = this.selected();
    if (channel) {
      this.engine.playChannelNote(channel.name, channel.volume, label);
    }
  }

  releaseNote(label: string): void {
    this.mousePressedNotes.update(notes => notes.filter(note => note !== label));
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
    const current = this.panels()[id];
    const visible = current.open && !current.collapsed;
    if (visible) {
      this.closePanel(id);
      return;
    }
    this.openPanel(id);
  }

  private openPanel(id: PanelId): void {
    const center = this.panels()[this.centerPanel()];
    const centerVisible = center.open && !center.collapsed;
    const floating = this.centerPanel() !== id && centerVisible;
    if (!floating) {
      this.centerPanel.set(id);
    }
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
    }
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
    const maximized = !this.panels()[id].maximized;
    if (maximized) {
      this.centerPanel.set(id);
    }
    this.panels.update(states => {
      const next = {} as PanelStates;
      (Object.keys(states) as PanelId[]).forEach(key => {
        const state = { ...states[key], maximized: key === id ? maximized : false };
        if (maximized && key !== id && state.open && !state.floating) {
          state.floating = true;
        }
        next[key] = state;
      });
      next[id] = { ...next[id], open: true, collapsed: false, floating: false };
      return next;
    });
    if (maximized) {
      this.frontPanel.set(id);
    }
  }

  togglePanelFloating(id: PanelId): void {
    const floating = !this.panels()[id].floating;
    if (!floating) {
      this.centerPanel.set(id);
    }
    this.panels.update(states => {
      const next = {} as PanelStates;
      (Object.keys(states) as PanelId[]).forEach(key => {
        const state = { ...states[key] };
        if (key === id) {
          state.open = true;
          state.collapsed = false;
          state.maximized = false;
          state.floating = floating;
        } else if (!floating && state.open && !state.floating) {
          state.floating = true;
        }
        next[key] = state;
      });
      return next;
    });
    this.frontPanel.set(id);
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
    const notes = channel.notes.map(row => ({
      ...row,
      notes: row.notes.slice(),
      lengths: row.lengths.slice()
    }));
    const hadNote = notes.some(row => row.notes[step]);
    if (!active) {
      if (!hadNote) {
        return;
      }
      notes.forEach(row => {
        row.notes[step] = false;
        row.lengths[step] = 1;
      });
    } else {
      const c5 = notes.find(row => row.label === 'C5');
      if (!c5) {
        return;
      }
      c5.notes[step] = true;
      c5.lengths[step] = 1;
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
      const lengths = item.lengths.slice();
      cells[step] = active;
      if (active) {
        lengths[step] = Math.max(1, lengths[step] ?? 1);
      } else {
        lengths[step] = 1;
      }
      return { ...item, notes: cells, lengths };
    });
    this.updateChannel(channel.id, { notes, steps: this.syncSteps(notes) });
    if (active) {
      this.playChannelNote(channel, row.label);
    }
  }

  resizeNote(rowIndex: number, oldStart: number, start: number, length: number): void {
    const channel = this.selected();
    const row = channel?.notes[rowIndex];
    if (!channel || !row) {
      return;
    }
    const total = this.pianoRollTotalSteps();
    const newStart = clamp(Math.round(start), 0, total - 1);
    const newLength = clamp(Number(length) || 1, 0.25, total - newStart);
    const notes = channel.notes.map((item, index) => {
      if (index !== rowIndex) {
        return item;
      }
      const cells = item.notes.slice();
      const lengths = item.lengths.slice();
      cells[oldStart] = false;
      lengths[oldStart] = 1;
      cells[newStart] = true;
      lengths[newStart] = Math.round(newLength * 100) / 100;
      return { ...item, notes: cells, lengths };
    });
    this.updateChannel(channel.id, { notes, steps: this.syncSteps(notes) });
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
    const center = this.panels()[this.centerPanel()];
    const centerVisible = center.open && !center.collapsed;
    const floating = this.centerPanel() !== 'pianoRoll' && centerVisible;
    if (!floating) {
      this.centerPanel.set('pianoRoll');
    }
    this.panels.update(states => ({
      ...states,
      pianoRoll: {
        ...states.pianoRoll,
        open: true,
        collapsed: false,
        maximized: false,
        floating
      }
    }));
    this.frontPanel.set('pianoRoll');
  }

  openClipInPianoRoll(clip: PlaylistClip): void {
    const pattern = this.patterns()[clip.pattern - 1];
    if (!pattern) {
      return;
    }
    const index = pattern.channels.findIndex(channel => channel.id === clip.channelId);
    this.setPattern(clip.pattern);
    this.openInPianoRoll(index >= 0 ? index : 0);
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
    const channel = this.channelForTrack(trackId);
    this.playlistClips.update(list => [
      ...list,
      {
        id: this.nextClipId++,
        track: trackId,
        start: barStart,
        length: this.stepsPerBar,
        pattern,
        channelId: channel?.id ?? 0,
        name: this.patterns()[pattern - 1]?.name ?? `Pattern ${pattern}`,
        color: channel?.color ?? track?.color ?? '#f5a623'
      }
    ]);
  }

  resizePlaylistClip(id: number, start: number, length: number): void {
    const total = this.playlistTotalSteps();
    this.playlistClips.update(list =>
      list.map(clip => {
        if (clip.id !== id) {
          return clip;
        }
        const newStart = clamp(start, 0, total - 0.25);
        const newLength = clamp(length, 0.25, total - newStart);
        return {
          ...clip,
          start: Math.round(newStart * 100) / 100,
          length: Math.round(newLength * 100) / 100
        };
      })
    );
  }

  togglePlaylistMute(trackId: number): void {    this.playlistTracks.update(list =>
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

  private resolveClipChannel(clip: PlaylistClip): Channel | undefined {
    const pattern = this.patterns()[clip.pattern - 1];
    if (!pattern) {
      return undefined;
    }
    return (
      pattern.channels.find(channel => channel.id === clip.channelId) ??
      pattern.channels[0]
    );
  }

  private channelForTrack(trackId: number): Channel | undefined {
    const channels = this.channels();
    return channels[trackId] ?? channels[this.selectedChannel()] ?? channels[0];
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
        notes: Array.from({ length: this.pianoRollTotalSteps() }, () => false),
        lengths: Array.from({ length: this.pianoRollTotalSteps() }, () => 1)
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
    const channels = this.channels();
    return Array.from({ length: 50 }, (_, index) => {
      const channel = channels[index];
      return {
        id: index,
        name: channel?.name ?? `Track ${index + 1}`,
        color: channel?.color ?? this.playlistPalette[index % this.playlistPalette.length],
        muted: false,
        solo: false
      };
    });
  }

  extendPlaylistBars(count = 8): void {
    this.playlistBars.update(bars => bars + count);
  }

  extendPianoRollBars(count = 4): void {
    const oldTotal = this.pianoRollTotalSteps();
    this.pianoRollBars.update(bars => bars + count);
    const newTotal = this.pianoRollTotalSteps();
    if (newTotal <= oldTotal) {
      return;
    }
    this.patterns.update(list =>
      list.map(pattern => ({
        ...pattern,
        channels: pattern.channels.map(channel => ({
          ...channel,
          notes: channel.notes.map(row => ({
            ...row,
            notes: [...row.notes, ...Array(newTotal - oldTotal).fill(false)],
            lengths: [...row.lengths, ...Array(newTotal - oldTotal).fill(1)]
          }))
        }))
      }))
    );
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
      const channels = this.patterns()[pattern - 1]?.channels ?? [];
      const channel =
        channels.find(item => item.id === track.id) ??
        channels[track.id % channels.length] ??
        channels[0];
      return {
        id,
        track: track.id,
        start: startBar * this.stepsPerBar,
        length: bars * this.stepsPerBar,
        pattern,
        channelId: channel?.id ?? 0,
        name: this.patternNames[(pattern - 1) % this.patternNames.length],
        color: channel?.color ?? track.color
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
      this.absoluteStep = (this.absoluteStep + 1) % this.playlistTotalSteps();
      this.playlistStep.set(this.absoluteStep);
      this.currentStep.set(this.absoluteStep % this.pianoRollTotalSteps());
      this.triggerPlaylistStep(this.absoluteStep);
      return;
    }
    this.absoluteStep = (this.absoluteStep + 1) % this.pianoRollTotalSteps();
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
      const channel = this.resolveClipChannel(clip);
      if (!channel || channel.muted) {
        continue;
      }
      const localStep = (songStep - clip.start) % this.pianoRollTotalSteps();
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
