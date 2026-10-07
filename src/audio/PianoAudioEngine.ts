import { connectAudioOutput } from "./output";
const SAMPLE_SECONDS = 6;
const CACHE_LIMIT = 16;
const VOICE_LIMIT = 32;
const RELEASE_SECONDS = 0.14;
const VOICE_GAIN = 0.5;

type PianoVoice = {
  id: string;
  source: AudioBufferSourceNode;
  envelope: GainNode;
  disconnected: boolean;
};

/**
 * Finite struck-string samples with a quick hammer attack and independently
 * decaying partials. Web Audio supplies polyphony and the key-release envelope.
 */
export class PianoAudioEngine {
  private context: AudioContext | null = null;
  private disconnectOutput: (() => void) | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private readonly voices = new Map<string, PianoVoice>();
  private readonly connectedVoices = new Set<PianoVoice>();
  private readonly sampleCache = new Map<number, AudioBuffer>();
  private disposed = false;

  constructor(private readonly onVoiceEnd?: (id: string) => void) {}

  async activate(): Promise<boolean> {
    if (this.disposed) return false;
    const context = this.getContext();
    if (!context || context.state === "closed") return false;
    try {
      if (context.state === "suspended") await context.resume();
      return context.state === "running";
    } catch { return false; }
  }

  play(id: string, midi: number): boolean {
    if (this.disposed || !Number.isInteger(midi) || midi < 21 || midi > 108) return false;

    const context = this.getContext();
    if (!context || !this.master || context.state === "closed") return false;
    // Invoked directly by a pointer or keyboard gesture, before sample rendering.
    if (context.state === "suspended") void context.resume().catch(() => {});

    const previous = this.voices.get(id);
    if (previous) {
      this.voices.delete(id);
      this.stopImmediately(previous);
    }
    // Release tails also count toward the node limit.
    if (this.connectedVoices.size >= VOICE_LIMIT) {
      const oldest = this.connectedVoices.values().next().value;
      if (oldest) {
        const wasHeld = this.voices.get(oldest.id) === oldest;
        if (wasHeld) this.voices.delete(oldest.id);
        this.stopImmediately(oldest);
        if (wasHeld) this.onVoiceEnd?.(oldest.id);
      }
    }

    let voice: PianoVoice | null = null;
    try {
      const sample = this.getSample(context, midi);
      const source = context.createBufferSource();
      const envelope = context.createGain();
      voice = { id, source, envelope, disconnected: false };
      source.buffer = sample;
      envelope.gain.value = VOICE_GAIN;
      source.connect(envelope).connect(this.master);
      this.voices.set(id, voice);
      this.connectedVoices.add(voice);
      const startedVoice = voice;
      source.onended = () => {
        if (this.voices.get(id) === startedVoice) {
          this.voices.delete(id);
          this.onVoiceEnd?.(id);
        }
        this.disconnectVoice(startedVoice);
      };
      source.start();
      return true;
    } catch {
      if (voice) {
        if (this.voices.get(id) === voice) this.voices.delete(id);
        this.stopImmediately(voice);
      }
      return false;
    }
  }

  release(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    const context = this.context;
    if (!context || context.state === "closed") {
      this.stopImmediately(voice);
      return;
    }
    const now = context.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(VOICE_GAIN, now);
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_SECONDS);
    try { voice.source.stop(now + RELEASE_SECONDS + 0.01); } catch { /* already ended */ }
  }

  stopAll(): void {
    this.voices.clear();
    // Includes notes already released but still finishing their short tails.
    for (const voice of [...this.connectedVoices]) this.stopImmediately(voice);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAll();
    this.sampleCache.clear();
    this.disconnectOutput?.();
    this.disconnectOutput = null;
    this.master?.disconnect();
    this.limiter?.disconnect();
    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => {});
    }
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
      master.gain.value = 0.22;
      // Ordinary notes pass through unchanged; dense sustained overlaps are
      // softly bounded below full scale instead of clipping at the destination.
      const limiter = context.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i += 1) {
        const value = i * 2 / (curve.length - 1) - 1;
        const magnitude = Math.abs(value);
        curve[i] = magnitude <= 0.6 ? value
          : Math.sign(value) * (0.6 + 0.3 * Math.tanh((magnitude - 0.6) / 0.3));
      }
      limiter.curve = curve;
      master.connect(limiter);
      this.disconnectOutput = connectAudioOutput(context, limiter);
      this.context = context;
      this.master = master;
      this.limiter = limiter;
      return context;
    } catch {
      this.disconnectOutput?.();
      this.disconnectOutput = null;
      if (context) void context.close().catch(() => {});
      this.context = null;
      this.master = null;
      return null;
    }
  }

  private getSample(context: AudioContext, midi: number): AudioBuffer {
    const cached = this.sampleCache.get(midi);
    if (cached) {
      this.sampleCache.delete(midi);
      this.sampleCache.set(midi, cached);
      return cached;
    }

    const sampleRate = context.sampleRate;
    const sampleCount = Math.ceil(sampleRate * SAMPLE_SECONDS);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const output = buffer.getChannelData(0);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const decaySeconds = Math.max(0.7, 2.2 - (midi - 48) * 0.018);

    for (let harmonic = 1; harmonic <= 10; harmonic += 1) {
      // Slight string stiffness keeps the hammer tone from sounding like an organ.
      const partialFrequency = frequency * harmonic * Math.sqrt(1 + 0.00007 * harmonic ** 2);
      if (partialFrequency >= sampleRate * 0.45) break;
      const angle = 2 * Math.PI * partialFrequency / sampleRate;
      const rotationCos = Math.cos(angle);
      const rotationSin = Math.sin(angle);
      const partialDecay = decaySeconds / (1 + (harmonic - 1) * 0.52);
      const decay = Math.exp(-1 / (sampleRate * partialDecay));
      let amplitude = 1 / harmonic ** 1.45;
      let sine = 0;
      let cosine = 1;

      for (let i = 0; i < sampleCount; i += 1) {
        output[i] += sine * amplitude;
        const nextSine = sine * rotationCos + cosine * rotationSin;
        cosine = cosine * rotationCos - sine * rotationSin;
        sine = nextSine;
        amplitude *= decay;
      }
    }

    const attackSamples = Math.max(1, Math.round(sampleRate * 0.003));
    const tailSamples = Math.round(sampleRate * 0.12);
    let peak = 0;
    for (let i = 0; i < sampleCount; i += 1) {
      const attack = Math.min(1, i / attackSamples);
      const tail = Math.min(1, (sampleCount - 1 - i) / tailSamples);
      output[i] *= attack * tail;
      peak = Math.max(peak, Math.abs(output[i]));
    }
    if (peak > 0) {
      const scale = 0.82 / peak;
      for (let i = 0; i < sampleCount; i += 1) output[i] *= scale;
    }

    this.sampleCache.set(midi, buffer);
    if (this.sampleCache.size > CACHE_LIMIT) {
      const oldest = this.sampleCache.keys().next().value;
      if (oldest !== undefined) this.sampleCache.delete(oldest);
    }
    return buffer;
  }

  private stopImmediately(voice: PianoVoice): void {
    if (voice.disconnected) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* already ended or not started */ }
    this.disconnectVoice(voice);
  }

  private disconnectVoice(voice: PianoVoice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    this.connectedVoices.delete(voice);
    voice.source.disconnect();
    voice.envelope.disconnect();
  }
}
