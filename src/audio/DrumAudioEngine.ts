import { DRUM_PADS, type DrumId } from "../drums/model";

const VOICE_LIMIT = 32;
const ACTIVE_VOICE_LIMIT = 24;
const FADE_SECONDS = 0.008;
const VOICE_GAIN = 0.5;
const SAMPLE_SECONDS: Record<DrumId, number> = {
  kick: 0.65,
  snare: 0.42,
  "closed-hat": 0.16,
  "open-hat": 1.1,
  "high-tom": 0.75,
  "low-tom": 1,
  crash: 2.6,
  ride: 1.8,
};

type DrumVoice = {
  id: string;
  drum: DrumId;
  source: AudioBufferSourceNode;
  envelope: GainNode;
  disconnected: boolean;
  fading: boolean;
};

/** Finite synthesized hits: no samples to download and no key-release envelope. */
export class DrumAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private readonly voices = new Map<string, DrumVoice>();
  private readonly connectedVoices = new Set<DrumVoice>();
  // Exactly one sample per pad; all eight entries fit in the bounded cache.
  private readonly sampleCache = new Map<DrumId, AudioBuffer>();
  private disposed = false;

  constructor(private readonly onVoiceEnd?: (id: string) => void) {}

  play(id: string, drum: DrumId): boolean {
    if (this.disposed || !DRUM_PADS.some((pad) => pad.id === drum)) return false;
    const context = this.getContext();
    if (!context || !this.master || context.state === "closed") return false;
    // Keep resume directly inside the pointer/keyboard gesture.
    if (context.state === "suspended") void context.resume().catch(() => {});

    const previous = this.voices.get(id);
    if (previous) this.fadeVoice(previous);
    if (drum === "closed-hat") {
      for (const voice of this.voices.values()) {
        if (voice.drum === "open-hat") this.fadeVoice(voice);
      }
    }
    // Reserve room for short choke/stealing tails and count every connected node.
    if (this.voices.size >= ACTIVE_VOICE_LIMIT) {
      const oldest = this.voices.values().next().value;
      if (oldest) this.fadeVoice(oldest);
    }
    if (this.connectedVoices.size >= VOICE_LIMIT) {
      // Only extreme bursts fill the tail reserve; retire the oldest tail first.
      const oldestTail = [...this.connectedVoices].find((voice) => voice.fading);
      if (oldestTail) this.stopImmediately(oldestTail);
      else return false;
    }

    let voice: DrumVoice | null = null;
    try {
      const sample = this.getSample(context, drum);
      const source = context.createBufferSource();
      const envelope = context.createGain();
      voice = { id, drum, source, envelope, disconnected: false, fading: false };
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

  stopAll(): void {
    for (const voice of [...this.connectedVoices]) {
      if (voice.fading && this.context?.state !== "running") this.stopImmediately(voice);
      else this.fadeVoice(voice);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.voices.clear();
    for (const voice of [...this.connectedVoices]) this.stopImmediately(voice);
    this.sampleCache.clear();
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
      master.gain.value = 0.42;
      const limiter = context.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i += 1) {
        const value = i * 2 / (curve.length - 1) - 1;
        const magnitude = Math.abs(value);
        curve[i] = magnitude <= 0.6 ? value
          : Math.sign(value) * (0.6 + 0.3 * Math.tanh((magnitude - 0.6) / 0.3));
      }
      limiter.curve = curve;
      master.connect(limiter).connect(context.destination);
      this.context = context;
      this.master = master;
      this.limiter = limiter;
      return context;
    } catch {
      if (context) void context.close().catch(() => {});
      return null;
    }
  }

  private getSample(context: AudioContext, drum: DrumId): AudioBuffer {
    const cached = this.sampleCache.get(drum);
    if (cached) return cached;
    const sampleRate = context.sampleRate;
    const sampleCount = Math.ceil(sampleRate * SAMPLE_SECONDS[drum]);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const output = buffer.getChannelData(0);
    const cymbal = drum === "closed-hat" || drum === "open-hat" || drum === "crash" || drum === "ride";
    const frequencies = drum === "ride"
      ? [731, 1093, 1831, 2677, 4211, 6317]
      : drum === "crash"
        ? [523, 809, 1327, 2053, 3181, 4793]
        : [3173, 4211, 5261, 6353, 7393, 8537];
    const modes = frequencies.filter((frequency) => frequency < sampleRate * 0.45).map((frequency) => ({
      sine: 0,
      cosine: 1,
      rotationSin: Math.sin(2 * Math.PI * frequency / sampleRate),
      rotationCos: Math.cos(2 * Math.PI * frequency / sampleRate),
    }));
    const cymbalDecay = drum === "closed-hat" ? 0.035 : drum === "open-hat" ? 0.22 : drum === "crash" ? 0.55 : 0.36;
    let phase = 0;
    let filteredNoise = 0;
    let peak = 0;
    // Repeatable noise makes cached synthesized hits consistent.
    let noiseSeed = 12345 + DRUM_PADS.findIndex((pad) => pad.id === drum) * 777;
    const noiseAlpha = 1 - Math.exp(-2 * Math.PI * (cymbal ? 6000 : 1800) / sampleRate);
    const attackSamples = Math.max(1, Math.round(sampleRate * 0.001));
    const tailSamples = Math.max(1, Math.round(sampleRate * 0.02));

    for (let i = 0; i < sampleCount; i += 1) {
      const time = i / sampleRate;
      noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) | 0;
      const noise = (noiseSeed >>> 0) / 2147483648 - 1;
      filteredNoise += noiseAlpha * (noise - filteredNoise);
      let value: number;

      if (drum === "kick") {
        phase += 2 * Math.PI * (48 + 110 * Math.exp(-time / 0.018)) / sampleRate;
        value = Math.sin(phase) * Math.exp(-time / 0.14)
          + noise * 0.12 * Math.exp(-time / 0.004);
      } else if (drum === "snare") {
        phase += 2 * Math.PI * 180 / sampleRate;
        value = (noise - filteredNoise) * 0.8 * Math.exp(-time / 0.075)
          + (Math.sin(phase) + Math.sin(phase * 1.73) * 0.45) * 0.4 * Math.exp(-time / 0.045);
      } else if (drum === "high-tom" || drum === "low-tom") {
        const fundamental = drum === "high-tom" ? 155 : 88;
        const decay = drum === "high-tom" ? 0.16 : 0.22;
        phase += 2 * Math.PI * (fundamental + 45 * Math.exp(-time / 0.028)) / sampleRate;
        value = (Math.sin(phase) + Math.sin(phase * 1.59) * 0.35) * Math.exp(-time / decay)
          + filteredNoise * 0.2 * Math.exp(-time / 0.012);
      } else {
        let metal = 0;
        for (const mode of modes) {
          metal += mode.sine;
          const nextSine = mode.sine * mode.rotationCos + mode.cosine * mode.rotationSin;
          mode.cosine = mode.cosine * mode.rotationCos - mode.sine * mode.rotationSin;
          mode.sine = nextSine;
        }
        const noiseMix = drum === "ride" ? 0.3 : drum === "crash" ? 0.9 : 0.65;
        value = ((noise - filteredNoise) * noiseMix + metal * 0.075) * Math.exp(-time / cymbalDecay);
        if (drum === "ride") value += Math.sin(2 * Math.PI * 2843 * time) * 0.22 * Math.exp(-time / 0.1);
      }
      const attack = Math.min(1, i / attackSamples);
      const tail = Math.min(1, (sampleCount - 1 - i) / tailSamples);
      output[i] = value * attack * tail;
      peak = Math.max(peak, Math.abs(output[i]));
    }
    if (peak > 0) {
      const scale = (drum === "closed-hat" ? 0.55 : drum === "open-hat" ? 0.65 : 0.85) / peak;
      for (let i = 0; i < sampleCount; i += 1) output[i] *= scale;
    }
    this.sampleCache.set(drum, buffer);
    return buffer;
  }

  private fadeVoice(voice: DrumVoice): void {
    if (voice.disconnected || voice.fading) return;
    voice.fading = true;
    if (this.voices.get(voice.id) === voice) {
      this.voices.delete(voice.id);
      this.onVoiceEnd?.(voice.id);
    }
    const context = this.context;
    if (!context || context.state !== "running") {
      this.stopImmediately(voice);
      return;
    }
    const now = context.currentTime;
    voice.envelope.gain.setValueAtTime(VOICE_GAIN, now);
    voice.envelope.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    try { voice.source.stop(now + FADE_SECONDS); } catch { this.disconnectVoice(voice); }
  }

  private stopImmediately(voice: DrumVoice): void {
    if (voice.disconnected) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* already ended or not started */ }
    this.disconnectVoice(voice);
  }

  private disconnectVoice(voice: DrumVoice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    this.connectedVoices.delete(voice);
    voice.source.disconnect();
    voice.envelope.disconnect();
  }
}
