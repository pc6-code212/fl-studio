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
  }

  toggleNote(row: PianoRow, step: number): void {
    row.notes[step] = !row.notes[step];
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
  }

  private startClock(): void {
    this.stopClock();
    const stepMs = 60000 / this.bpm / 4;
    this.clock = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.stepCount;
    }, stepMs);
  }

  private stopClock(): void {
    if (this.clock) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }
}
