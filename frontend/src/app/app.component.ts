import { Component, HostListener, OnDestroy } from '@angular/core';

interface Channel {
  id: number;
  name: string;
  color: string;
  steps: boolean[];
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

interface PianoRow {
  label: string;
  black: boolean;
  notes: boolean[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
  readonly stepCount = 16;
  readonly steps = Array.from({ length: this.stepCount }, (_, i) => i);

  bpm = 140;
  swing = 0;
  masterVolume = 82;
  isPlaying = false;
  isRecording = false;
  songMode = false;
  currentStep = -1;
  selectedChannel = 0;

  patternNumber = 1;
  patternNames = ['Intro', 'Verse', 'Build', 'Drop', 'Break', 'Outro', 'Fill', 'Idea'];
  activeBrowserTab = 'packs';

  channels: Channel[] = this.createChannels();
  pianoRows: PianoRow[] = this.createPianoRows();

  browserSections = [
    { title: 'Packs', items: ['Kicks', 'Snares', 'Claps', 'Hats', 'Percussion', 'Bass', 'Synths', 'FX'] },
    { title: 'Channel presets', items: ['3xOsc', 'FLEX', 'Sytrus', 'Sakura', 'Drumaxx', 'Slicex'] },
    { title: 'Mixer presets', items: ['Vocal chain', 'Drum bus', 'Master glue', 'Reverb send'] },
    { title: 'Projects', items: ['New project', 'Demo track', 'Template'] }
  ];

  private clock: any = null;
  private audio: AudioContext | null = null;
  private masterNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private readonly leadNotes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 440];
  private readonly bassNotes = [55, 55, 65.41, 49, 55, 73.42, 55, 61.74];
  private readonly padChords = [[110, 130.81, 164.81], [98, 123.47, 146.83], [87.31, 110, 130.81], [98, 116.54, 146.83]];

  constructor() {
    this.resetPianoNotes();
  }

  get patternName(): string {
    return this.patternNames[(this.patternNumber - 1) % this.patternNames.length];
  }

  get selected(): Channel {
    return this.channels[this.selectedChannel];
  }

  get mixerChannels(): Channel[] {
    return this.channels;
  }

  createChannels(): Channel[] {
    const make = (id: number, name: string, color: string, on: number[] = []): Channel => {
      const steps = Array.from({ length: this.stepCount }, () => false);
      on.forEach(s => (steps[s] = true));
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

  createPianoRows(): PianoRow[] {
    const labels = ['C6', 'B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5'];
    return labels.map(label => ({
      label,
      black: label.includes('#'),
      notes: Array.from({ length: this.stepCount }, () => false)
    }));
  }

  resetPianoNotes(): void {
    const melody: Array<[number, number[]]> = [
      [0, [0, 4, 8, 12]],
      [2, [2, 6, 10, 14]],
      [4, [0, 6, 8]],
      [7, [0, 4, 8, 12]],
      [9, [2, 10]],
      [11, [6, 14]]
    ];
    melody.forEach(([row, cols]) => {
      cols.forEach(c => (this.pianoRows[row].notes[c] = true));
    });
  }

  toggleStep(channel: Channel, step: number): void {
    channel.steps[step] = !channel.steps[step];
    if (channel.steps[step]) {
      this.playChannel(channel, step);
    }
  }

  toggleNote(row: PianoRow, step: number): void {
    row.notes[step] = !row.notes[step];
    if (row.notes[step]) {
      this.playPianoNote(row.label, step);
    }
  }

  previewChannel(channel: Channel): void {
    this.playChannel(channel, 0);
  }

  toggleMute(channel: Channel, event: Event): void {
    event.stopPropagation();
    channel.muted = !channel.muted;
  }

  toggleSolo(channel: Channel, event: Event): void {
    event.stopPropagation();
    channel.solo = !channel.solo;
  }

  togglePlay(): void {
    if (this.isPlaying) {
      this.isPlaying = false;
      this.currentStep = -1;
      this.stopClock();
    } else {
      this.ensureAudio();
      this.isPlaying = true;
      this.currentStep = -1;
      this.startClock();
    }
  }

  stop(): void {
    this.isPlaying = false;
    this.isRecording = false;
    this.currentStep = -1;
    this.stopClock();
  }

  toggleRecord(): void {
    this.isRecording = !this.isRecording;
    if (this.isRecording && !this.isPlaying) {
      this.togglePlay();
    }
  }

  onBpmChange(): void {
    this.bpm = Math.min(300, Math.max(20, Number(this.bpm) || 140));
    if (this.isPlaying) {
      this.startClock();
    }
  }

  onMasterVolumeChange(): void {
    this.masterVolume = Math.min(100, Math.max(0, Number(this.masterVolume) || 0));
    if (this.masterNode && this.audio) {
      this.masterNode.gain.setTargetAtTime(this.masterGainValue(), this.audio.currentTime, 0.02);
    }
  }

  prevPattern(): void {
    this.patternNumber = this.patternNumber <= 1 ? 8 : this.patternNumber - 1;
  }

  nextPattern(): void {
    this.patternNumber = this.patternNumber >= 8 ? 1 : this.patternNumber + 1;
  }

  selectChannel(index: number): void {
    this.selectedChannel = index;
  }

  knobAngle(value: number): number {
    return -135 + (value / 100) * 270;
  }

  meterLevel(index: number): number {
    if (!this.isPlaying) {
      return 0;
    }
    const base = [68, 44, 58, 34, 50, 40, 30, 22][index % 8];
    const jitter = ((this.currentStep * 37 + index * 13) % 23) - 11;
    return Math.max(8, Math.min(100, base + jitter));
  }

  @HostListener('window:keydown', ['$event'])
  handleShortcut(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePlay();
    }
  }

  ngOnDestroy(): void {
    this.stopClock();
    if (this.audio) {
      this.audio.close();
      this.audio = null;
      this.masterNode = null;
    }
  }

  private startClock(): void {
    this.stopClock();
    const stepMs = 60000 / this.bpm / 4;
    this.clock = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.stepCount;
      this.triggerStep(this.currentStep);
    }, stepMs);
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private triggerStep(step: number): void {
    const anySolo = this.channels.some(c => c.solo);
    this.channels.forEach(ch => {
      if (ch.steps[step] && !ch.muted && (!anySolo || ch.solo)) {
        this.playChannel(ch, step);
      }
    });
    this.pianoRows.forEach(row => {
      if (row.notes[step]) {
        this.playPianoNote(row.label, step);
      }
    });
  }

  private ensureAudio(): AudioContext {
    if (!this.audio) {
      const Ctor: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audio = new Ctor();
      this.masterNode = this.audio.createGain();
      this.masterNode.gain.value = this.masterGainValue();
      this.masterNode.connect(this.audio.destination);
    }
    if (this.audio.state === 'suspended') {
      this.audio.resume();
    }
    return this.audio;
  }

  private masterGainValue(): number {
    return Math.pow(this.masterVolume / 100, 1.5);
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private playChannel(ch: Channel, step: number): void {
    const ctx = this.ensureAudio();
    const t = ctx.currentTime + 0.005;
    const vol = Math.pow(ch.volume / 100, 1.4);
    const name = ch.name.toLowerCase();

    if (name.includes('kick')) {
      this.playKick(ctx, t, vol);
    } else if (name.includes('clap')) {
      this.playNoiseHit(ctx, t, vol, 1100, 'bandpass', 0.16, 0.6);
    } else if (name.includes('snare')) {
      this.playNoiseHit(ctx, t, vol, 1700, 'highpass', 0.19, 0.55);
    } else if (name.includes('hat')) {
      this.playNoiseHit(ctx, t, vol * 0.8, 8000, 'highpass', 0.055, 0.4);
    } else if (name.includes('bass') || name.includes('808')) {
      this.playBass(ctx, t, vol, this.bassNotes[step % this.bassNotes.length]);
    } else if (name.includes('pad')) {
      this.playPad(ctx, t, vol * 0.65, this.padChords[Math.floor(step / 4) % this.padChords.length]);
    } else if (name.includes('fx')) {
      this.playRiser(ctx, t, vol * 0.7);
    } else {
      this.playLead(ctx, t, vol, this.leadNotes[step % this.leadNotes.length]);
    }
  }

  private playKick(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 1.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(gain).connect(this.masterNode!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private playNoiseHit(ctx: AudioContext, t: number, vol: number, freq: number, type: BiquadFilterType, decay: number, level: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * level, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(gain).connect(this.masterNode!);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  private playBass(ctx: AudioContext, t: number, vol: number, freq: number): void {
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    sub.type = 'sine';
    osc.frequency.value = freq;
    sub.frequency.value = freq / 2;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.35);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 0.7, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.masterNode!);
    osc.start(t);
    sub.start(t);
    osc.stop(t + 0.55);
    sub.stop(t + 0.55);
  }

  private playLead(ctx: AudioContext, t: number, vol: number, freq: number): void {
    const osc = ctx.createOscillator();
    const detune = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    detune.type = 'sawtooth';
    osc.frequency.value = freq;
    detune.frequency.value = freq;
    detune.detune.value = 8;
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(filter);
    detune.connect(filter);
    filter.connect(gain).connect(this.masterNode!);
    osc.start(t);
    detune.start(t);
    osc.stop(t + 0.32);
    detune.stop(t + 0.32);
  }

  private playPad(ctx: AudioContext, t: number, vol: number, chord: number[]): void {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 0.16, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    gain.connect(this.masterNode!);
    filter.connect(gain);
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = i * 6 - 6;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 1.45);
    });
  }

  private playRiser(ctx: AudioContext, t: number, vol: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(7000, t + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 0.28, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    src.connect(filter).connect(gain).connect(this.masterNode!);
    src.start(t);
    src.stop(t + 1);
  }

  private playPianoNote(label: string, step: number): void {
    const ctx = this.ensureAudio();
    const t = ctx.currentTime + 0.005;
    const freq = this.noteFreq(label);
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc2.type = 'sine';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterNode!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.3);
    osc2.stop(t + 0.3);
  }

  private noteFreq(label: string): number {
    const semitones: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    const match = label.match(/^([A-G]#?)(\d)$/);
    if (!match) {
      return 440;
    }
    const midi = semitones[match[1]] + (parseInt(match[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}
