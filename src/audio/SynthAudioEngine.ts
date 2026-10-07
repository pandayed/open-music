import { connectAudioOutput } from "./output";
import type { SynthSettings } from "../synth/model";

type SynthVoice = {
  id: string;
  oscillators: OscillatorNode[];
  nodes: AudioNode[];
  envelope: GainNode;
  disconnected: boolean;
};

const ECHO_SECONDS = 60 / 122 / 2;
const VOICE_LIMIT = 8;

/** An original mono pluck approximation, not the recording's NN-19 sample. */
export class SynthAudioEngine {
  private context: AudioContext | null = null;
  private disconnectOutput: (() => void) | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private current: SynthVoice | null = null;
  private readonly voices = new Set<SynthVoice>();
  private readonly pulseWaves = new Map<number, PeriodicWave>();
  private disposed = false;

  constructor(private readonly onVoiceEnd: (id: string) => void) {}

  async activate(): Promise<boolean> {
    if (this.disposed) return false;
    const context = this.getContext();
    if (!context || context.state === "closed") return false;
    try {
      if (context.state === "suspended") await context.resume();
      return context.state === "running";
    } catch { return false; }
  }

  play(id: string, midi: number, settings: SynthSettings): boolean {
    if (this.disposed || !Number.isInteger(midi) || midi < 36 || midi > 100) return false;
    const context = this.getContext();
    if (!context || !this.master || context.state === "closed") return false;
    if (context.state === "suspended") void context.resume().catch(() => {});
    if (this.current) this.release(this.current.id);
    if (this.voices.size >= VOICE_LIMIT) {
      const oldest = this.voices.values().next().value;
      if (oldest) this.disconnectVoice(oldest);
    }

    const now = context.currentTime;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const decay = settings.decay / 1000;
    const envelope = context.createGain();
    const filter = context.createBiquadFilter();
    const delay = context.createDelay(1);
    const wet = context.createGain();
    const voice: SynthVoice = { id, oscillators: [], nodes: [envelope, filter, delay, wet], envelope, disconnected: false };
    this.voices.add(voice);

    try {
      filter.type = "lowpass";
      filter.Q.value = 1.1;
      const floor = Math.min(1800, frequency * 1.8);
      const peak = Math.min(context.sampleRate * 0.4, frequency * (3 + settings.brightness * 0.24));
      filter.frequency.setValueAtTime(peak, now);
      filter.frequency.exponentialRampToValueAtTime(floor, now + decay * 0.8);
      // Fast attack, zero sustain: a held key still naturally fades away.
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.32, now + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay * 2.5);
      envelope.gain.setValueAtTime(0, now + decay * 2.5 + 0.01);
      filter.connect(envelope).connect(this.master);
      delay.delayTime.value = ECHO_SECONDS;
      wet.gain.value = settings.echo / 100;
      envelope.connect(delay).connect(wet).connect(this.master);

      // Two differently shaped pulse tones and a triangle sub give the pluck
      // its hollow, reed-like edge and low-end body. Web Audio bandlimits waves.
      for (const [ratio, width, level, detune] of [[1, 0.6, 0.5, -1.5], [2, 0.7, 0.6, 1.5], [0.5, 0, 0.4, 0]]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        voice.oscillators.push(oscillator);
        voice.nodes.push(gain);
        oscillator.frequency.value = frequency * ratio;
        oscillator.detune.value = detune;
        if (width) oscillator.setPeriodicWave(this.getPulse(context, width));
        else oscillator.type = "triangle";
        gain.gain.value = level;
        oscillator.connect(gain).connect(filter);
      }
      voice.oscillators[0].onended = () => {
        if (this.current === voice) {
          this.current = null;
          this.onVoiceEnd(id);
        }
        this.disconnectVoice(voice);
      };
      this.current = voice;
      for (const oscillator of voice.oscillators) {
        oscillator.start(now);
        oscillator.stop(now + decay * 2.5 + ECHO_SECONDS + 0.02);
      }
      return true;
    } catch {
      if (this.current === voice) this.current = null;
      this.disconnectVoice(voice);
      return false;
    }
  }

  release(id: string): void {
    const voice = this.current;
    if (!voice || voice.id !== id || !this.context) return;
    this.current = null;
    const now = this.context.currentTime;
    voice.envelope.gain.cancelAndHoldAtTime(now);
    voice.envelope.gain.linearRampToValueAtTime(0, now + 0.35);
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop(now + 0.35 + ECHO_SECONDS + 0.02); } catch { /* already ended */ }
    }
    this.onVoiceEnd(id);
  }

  stopAll(): void {
    this.current = null;
    // Disconnecting per-voice effects also clears every echo tail immediately.
    for (const voice of [...this.voices]) this.disconnectVoice(voice);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAll();
    this.pulseWaves.clear();
    this.disconnectOutput?.();
    this.disconnectOutput = null;
    this.master?.disconnect();
    this.limiter?.disconnect();
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.limiter = null;
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext({ latencyHint: "interactive" });
      const master = context.createGain();
      master.gain.value = 0.65;
      const limiter = context.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(i * 2 / (curve.length - 1) - 1);
      limiter.curve = curve;
      master.connect(limiter);
      this.disconnectOutput = connectAudioOutput(context, limiter);
      this.context = context;
      this.master = master;
      this.limiter = limiter;
      return context;
    } catch {
      if (context) void context.close().catch(() => {});
      return null;
    }
  }

  private getPulse(context: AudioContext, width: number): PeriodicWave {
    const cached = this.pulseWaves.get(width);
    if (cached) return cached;
    const real = new Float32Array(129);
    const imag = new Float32Array(129);
    for (let n = 1; n < real.length; n += 1) {
      real[n] = 2 * Math.sin(2 * Math.PI * n * width) / (Math.PI * n);
      imag[n] = 2 * (1 - Math.cos(2 * Math.PI * n * width)) / (Math.PI * n);
    }
    const wave = context.createPeriodicWave(real, imag);
    this.pulseWaves.set(width, wave);
    return wave;
  }

  private disconnectVoice(voice: SynthVoice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    this.voices.delete(voice);
    for (const oscillator of voice.oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* ended or not started */ }
      oscillator.disconnect();
    }
    for (const node of voice.nodes) node.disconnect();
  }
}
