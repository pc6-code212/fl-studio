import { Injectable, OnDestroy } from '@angular/core';
import { noteToFrequency } from '@shared/utils/notes';

export type VoiceName = string;

@Injectable({ providedIn: 'root' })
export class AudioEngineService implements OnDestroy {
  private audio: AudioContext | null = null;
  private masterNode: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterVolume = 82;

  private readonly leadNotes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 440];
  private readonly bassNotes = [55, 55, 65.41, 49, 55, 73.42, 55, 61.74];
  private readonly padChords = [
    [110, 130.81, 164.81],
    [98, 123.47, 146.83],
    [87.31, 110, 130.81],
    [98, 116.54, 146.83]
  ];

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.masterNode && this.audio) {
      this.masterNode.gain.setTargetAtTime(this.masterGainValue(), this.audio.currentTime, 0.02);
    }
  }

  playVoice(name: VoiceName, volume: number, step: number): void {
    const ctx = this.ensureAudio();
    const t = ctx.currentTime + 0.005;
    const vol = Math.pow(volume / 100, 1.4);
    const voice = name.toLowerCase();

    if (voice.includes('kick')) {
      this.playKick(ctx, t, vol);
    } else if (voice.includes('clap')) {
      this.playNoiseHit(ctx, t, vol, 1100, 'bandpass', 0.16, 0.6);
    } else if (voice.includes('snare')) {
      this.playNoiseHit(ctx, t, vol, 1700, 'highpass', 0.19, 0.55);
    } else if (voice.includes('hat')) {
      this.playNoiseHit(ctx, t, vol * 0.8, 8000, 'highpass', 0.055, 0.4);
    } else if (voice.includes('bass') || voice.includes('808')) {
      this.playBass(ctx, t, vol, this.bassNotes[step % this.bassNotes.length]);
    } else if (voice.includes('pad')) {
      this.playPad(ctx, t, vol * 0.65, this.padChords[Math.floor(step / 4) % this.padChords.length]);
    } else if (voice.includes('fx')) {
      this.playRiser(ctx, t, vol * 0.7);
    } else {
      this.playLead(ctx, t, vol, this.leadNotes[step % this.leadNotes.length]);
    }
  }

  playChannelNote(name: VoiceName, volume: number, label: string): void {
    const ctx = this.ensureAudio();
    const t = ctx.currentTime + 0.005;
    const vol = Math.pow(volume / 100, 1.4);
    const voice = name.toLowerCase();
    const freq = noteToFrequency(label);
    const ratio = freq / noteToFrequency('C5');

    if (voice.includes('kick')) {
      this.playKick(ctx, t, vol, ratio);
    } else if (voice.includes('clap')) {
      this.playNoiseHit(ctx, t, vol, 1100 * ratio, 'bandpass', 0.16, 0.6);
    } else if (voice.includes('snare')) {
      this.playNoiseHit(ctx, t, vol, 1700 * ratio, 'highpass', 0.19, 0.55);
    } else if (voice.includes('hat')) {
      this.playNoiseHit(ctx, t, vol * 0.8, 8000 * ratio, 'highpass', 0.055, 0.4);
    } else if (voice.includes('bass') || voice.includes('808')) {
      this.playBass(ctx, t, vol, freq);
    } else if (voice.includes('pad')) {
      this.playPad(ctx, t, vol * 0.65, [freq, freq * 1.2599, freq * 1.4983]);
    } else if (voice.includes('fx')) {
      this.playRiser(ctx, t, vol * 0.7, ratio);
    } else {
      this.playLead(ctx, t, vol, freq);
    }
  }

  playPianoNote(label: string): void {
    const ctx = this.ensureAudio();
    const t = ctx.currentTime + 0.005;
    const freq = noteToFrequency(label);
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

  ngOnDestroy(): void {
    if (this.audio) {
      this.audio.close();
      this.audio = null;
      this.masterNode = null;
    }
  }

  private ensureAudio(): AudioContext {
    if (!this.audio) {
      const Ctor: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
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

  private playKick(ctx: AudioContext, t: number, vol: number, ratio = 1): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155 * ratio, t);
    osc.frequency.exponentialRampToValueAtTime(42 * ratio, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 1.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    osc.connect(gain).connect(this.masterNode!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private playNoiseHit(
    ctx: AudioContext,
    t: number,
    vol: number,
    freq: number,
    type: BiquadFilterType,
    decay: number,
    level: number
  ): void {
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

  private playRiser(ctx: AudioContext, t: number, vol: number, ratio = 1): void {
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400 * ratio, t);
    filter.frequency.exponentialRampToValueAtTime(7000 * ratio, t + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol * 0.28, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    src.connect(filter).connect(gain).connect(this.masterNode!);
    src.start(t);
    src.stop(t + 1);
  }
}
