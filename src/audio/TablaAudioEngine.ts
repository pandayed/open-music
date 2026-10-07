import { connectAudioOutput } from "./output";
import type { TablaBol } from "../tabla/model";

const BOLS: readonly TablaBol[] = ["na", "tin", "tun", "te", "ge", "ke", "dha", "dhin"];
const VOICE_LIMIT = 32;
const ACTIVE_VOICE_LIMIT = 24;
const FADE_SECONDS = 0.008;
const VOICE_GAIN = 0.5;
const SAMPLE_SECONDS: Record<TablaBol, number> = {
  na: 0.65,
  tin: 0.9,
  tun: 1.1,
  te: 0.18,
  ge: 0.95,
  ke: 0.18,
  dha: 0.95,
  dhin: 0.95,
};

type SingleBol = Exclude<TablaBol, "dha" | "dhin">;
type Stroke = {
  fundamental: number;
  ratios: readonly number[];
  amplitudes: readonly number[];
  decay: number;
  pitchDrop: number;
  noise: number;
  noiseDecay: number;
};

// These modal tones approximate the contrast between strokes, not a recorded tabla.
// Dayan strokes share a tuning; their mode balance and damping distinguish them.
const STROKES: Record<SingleBol, Stroke> = {
  na: { fundamental: 320, ratios: [1, 2, 3, 4], amplitudes: [0.14, 0.75, 0.32, 0.18], decay: 0.12, pitchDrop: 4, noise: 0.22, noiseDecay: 0.009 },
  tin: { fundamental: 320, ratios: [1, 2, 3, 4], amplitudes: [0.55, 0.65, 0.26, 0.1], decay: 0.19, pitchDrop: 3, noise: 0.1, noiseDecay: 0.008 },
  tun: { fundamental: 320, ratios: [1, 2, 3, 4], amplitudes: [0.95, 0.32, 0.15, 0.06], decay: 0.24, pitchDrop: 6, noise: 0.12, noiseDecay: 0.01 },
  te: { fundamental: 420, ratios: [1, 1.47, 2.12], amplitudes: [0.4, 0.32, 0.2], decay: 0.025, pitchDrop: 25, noise: 0.7, noiseDecay: 0.016 },
  ge: { fundamental: 95, ratios: [1, 2, 3, 4.2], amplitudes: [0.95, 0.32, 0.15, 0.05], decay: 0.21, pitchDrop: 38, noise: 0.2, noiseDecay: 0.012 },
  ke: { fundamental: 145, ratios: [1, 1.63, 2.35], amplitudes: [0.55, 0.22, 0.12], decay: 0.025, pitchDrop: 28, noise: 0.75, noiseDecay: 0.016 },
};

type TablaVoice = {
  id: string;
  source: AudioBufferSourceNode;
  envelope: GainNode;
  disconnected: boolean;
  fading: boolean;
};

/** Finite, cached synthesized bols; each combined bol uses one playback voice. */
export class TablaAudioEngine {
  private context: AudioContext | null = null;
  private disconnectOutput: (() => void) | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private readonly voices = new Map<string, TablaVoice>();
  private readonly connectedVoices = new Set<TablaVoice>();
  // Bounded to the eight supported bols, including the two combined buffers.
  private readonly sampleCache = new Map<TablaBol, AudioBuffer>();
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

  play(id: string, bol: TablaBol): boolean {
    if (this.disposed || !BOLS.includes(bol)) return false;
    const context = this.getContext();
    if (!context || !this.master || context.state === "closed") return false;
    if (context.state === "suspended") void context.resume().catch(() => {});

    const previous = this.voices.get(id);
    if (previous) this.fadeVoice(previous);
    if (this.voices.size >= ACTIVE_VOICE_LIMIT) {
      const oldest = this.voices.values().next().value;
      if (oldest) this.fadeVoice(oldest);
    }
    if (this.connectedVoices.size >= VOICE_LIMIT) {
      const oldestTail = [...this.connectedVoices].find((voice) => voice.fading);
      if (oldestTail) this.stopImmediately(oldestTail);
      else return false;
    }

    let voice: TablaVoice | null = null;
    try {
      const sample = this.getSample(context, bol);
      const source = context.createBufferSource();
      const envelope = context.createGain();
      voice = { id, source, envelope, disconnected: false, fading: false };
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

  private getSample(context: AudioContext, bol: TablaBol): AudioBuffer {
    const cached = this.sampleCache.get(bol);
    if (cached) return cached;
    const sampleRate = context.sampleRate;
    const sampleCount = Math.ceil(sampleRate * SAMPLE_SECONDS[bol]);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const output = buffer.getChannelData(0);

    if (bol === "dha" || bol === "dhin") {
      // Simultaneous strokes: Dha = Na + Ge, Dhin = Tin + Ge.
      const dayan = this.getSample(context, bol === "dha" ? "na" : "tin").getChannelData(0);
      const bayan = this.getSample(context, "ge").getChannelData(0);
      for (let i = 0; i < sampleCount; i += 1) {
        output[i] = (dayan[i] ?? 0) + (bayan[i] ?? 0) * 0.9;
      }
    } else {
      const stroke = STROKES[bol];
      const modes = stroke.ratios.map((ratio, index) => ({
        ratio,
        amplitude: stroke.amplitudes[index],
        phase: 0,
        decay: stroke.decay / (1 + index * 0.27),
      })).filter((mode) => (stroke.fundamental + stroke.pitchDrop) * mode.ratio < sampleRate * 0.45);
      let noiseSeed = 9217 + BOLS.indexOf(bol) * 777;
      let filteredNoise = 0;
      const noiseCutoff = bol === "ge" || bol === "ke" ? 900 : 3600;
      const noiseAlpha = 1 - Math.exp(-2 * Math.PI * noiseCutoff / sampleRate);
      const attackSamples = Math.max(1, Math.round(sampleRate * 0.0007));
      const tailSamples = Math.max(1, Math.round(sampleRate * 0.015));

      for (let i = 0; i < sampleCount; i += 1) {
        const time = i / sampleRate;
        const frequency = stroke.fundamental + stroke.pitchDrop * Math.exp(-time / 0.035);
        let value = 0;
        for (const mode of modes) {
          mode.phase += 2 * Math.PI * frequency * mode.ratio / sampleRate;
          value += Math.sin(mode.phase) * mode.amplitude * Math.exp(-time / mode.decay);
        }
        noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) | 0;
        const noise = (noiseSeed >>> 0) / 2147483648 - 1;
        filteredNoise += noiseAlpha * (noise - filteredNoise);
        value += filteredNoise * stroke.noise * Math.exp(-time / stroke.noiseDecay);
        const attack = Math.min(1, i / attackSamples);
        const tail = Math.min(1, (sampleCount - 1 - i) / tailSamples);
        output[i] = value * attack * tail;
      }
    }

    let peak = 0;
    for (const value of output) peak = Math.max(peak, Math.abs(value));
    if (peak > 0) {
      const scale = 0.85 / peak;
      for (let i = 0; i < sampleCount; i += 1) output[i] *= scale;
    }
    this.sampleCache.set(bol, buffer);
    return buffer;
  }

  private fadeVoice(voice: TablaVoice): void {
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

  private stopImmediately(voice: TablaVoice): void {
    if (voice.disconnected) return;
    voice.source.onended = null;
    try { voice.source.stop(); } catch { /* already ended or not started */ }
    this.disconnectVoice(voice);
  }

  private disconnectVoice(voice: TablaVoice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    this.connectedVoices.delete(voice);
    voice.source.disconnect();
    voice.envelope.disconnect();
  }
}
