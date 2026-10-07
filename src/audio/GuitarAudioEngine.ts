import { connectAudioOutput } from "./output";
/** Low E through high E, in standard guitar tuning. */
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64] as const;

const SAMPLE_SECONDS = 9;
const CACHE_LIMIT = 12;
const RELEASE_SECONDS = 0.22;
const VIBRATO_SEMITONES = 0.16;
const VIBRATO_RATE_DEPTH = 2 ** (VIBRATO_SEMITONES / 12) - 1;

type PluckSample = {
  buffer: AudioBuffer;
  basePlaybackRate: number;
};

type Voice = {
  source: AudioBufferSourceNode;
  envelope: GainNode;
  vibratoDepth: GainNode;
  basePlaybackRate: number;
  startTime: number;
  disconnected: boolean;
};

/**
 * A small plucked-string instrument. A bounded Karplus-Strong string is
 * rendered on demand, then Web Audio handles scheduling, release, and pitch.
 * Keeping feedback outside the live audio graph avoids unstable filter cycles.
 */
export class GuitarAudioEngine {
  private context: AudioContext | null = null;
  private disconnectOutput: (() => void) | null = null;
  private master: GainNode | null = null;
  private vibratoOscillator: OscillatorNode | null = null;
  private readonly voices = new Map<string, Voice>();
  private readonly connectedVoices = new Set<Voice>();
  private readonly sampleCache = new Map<string, PluckSample>();
  private bendSemitones = 0;
  private vibratoEnabled = false;
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

  play(id: string, stringIndex: number, fret: number, delaySeconds = 0): void {
    if (
      this.disposed ||
      !Number.isInteger(stringIndex) ||
      stringIndex < 0 ||
      stringIndex >= OPEN_STRING_MIDI.length ||
      !Number.isInteger(fret) ||
      fret < 0 ||
      fret > 24
    ) return;

    // A fresh pluck with the same id replaces the previous held voice.
    this.stopVoiceImmediately(id);

    const context = this.getContext();
    if (!context || !this.master || !this.vibratoOscillator) return;

    // resume() must be invoked inside the keyboard/mouse user gesture.
    if (context.state === "suspended") void context.resume().catch(() => {});

    const sample = this.getSample(context, stringIndex, fret);
    const startTime = context.currentTime + Math.max(0, Math.min(delaySeconds, 0.25));
    const source = context.createBufferSource();
    source.buffer = sample.buffer;
    source.playbackRate.value = sample.basePlaybackRate * this.bendRatio();

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.52, startTime + 0.003);

    const vibratoDepth = context.createGain();
    vibratoDepth.gain.value = this.vibratoEnabled
      ? source.playbackRate.value * VIBRATO_RATE_DEPTH
      : 0;

    source.connect(envelope).connect(this.master);
    this.vibratoOscillator.connect(vibratoDepth).connect(source.playbackRate);

    const voice: Voice = {
      source,
      envelope,
      vibratoDepth,
      basePlaybackRate: sample.basePlaybackRate,
      startTime,
      disconnected: false,
    };
    this.voices.set(id, voice);
    this.connectedVoices.add(voice);
    source.onended = () => {
      if (this.voices.get(id) === voice) {
        this.voices.delete(id);
        this.onVoiceEnd?.(id);
      }
      this.disconnectVoice(voice);
    };
    source.start(startTime);
  }

  release(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);

    const context = this.context;
    if (!context || context.state === "closed") {
      this.disconnectVoice(voice);
      return;
    }

    const now = context.currentTime;
    if (now < voice.startTime) {
      // A quick strum tap should still articulate every staggered string.
      const releaseAt = voice.startTime + 0.12;
      voice.envelope.gain.setValueAtTime(0.52, releaseAt);
      voice.envelope.gain.exponentialRampToValueAtTime(0.0001, releaseAt + RELEASE_SECONDS);
      try { voice.source.stop(releaseAt + RELEASE_SECONDS + 0.01); } catch { /* already ended */ }
      return;
    }

    voice.envelope.gain.cancelAndHoldAtTime(now);
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_SECONDS);
    try { voice.source.stop(now + RELEASE_SECONDS + 0.01); } catch { /* already ended */ }
  }

  setBend(semitones: number): void {
    this.bendSemitones = Number.isFinite(semitones)
      ? Math.max(-2, Math.min(2, semitones))
      : 0;
    const context = this.context;
    if (!context || context.state === "closed") return;

    const now = context.currentTime;
    for (const voice of this.voices.values()) {
      const rate = voice.basePlaybackRate * this.bendRatio();
      voice.source.playbackRate.cancelScheduledValues(now);
      voice.source.playbackRate.setTargetAtTime(rate, now, 0.012);
      if (this.vibratoEnabled) {
        voice.vibratoDepth.gain.setTargetAtTime(rate * VIBRATO_RATE_DEPTH, now, 0.012);
      }
    }
  }

  setVibrato(enabled: boolean): void {
    this.vibratoEnabled = enabled;
    const context = this.context;
    if (!context || context.state === "closed") return;

    const now = context.currentTime;
    for (const voice of this.voices.values()) {
      const depth = enabled
        ? voice.basePlaybackRate * this.bendRatio() * VIBRATO_RATE_DEPTH
        : 0;
      voice.vibratoDepth.gain.setTargetAtTime(depth, now, 0.025);
    }
  }

  stopAll(): void {
    // Includes voices whose key was already released while a strum was queued.
    for (const voice of [...this.connectedVoices]) this.silenceVoice(voice);
    this.voices.clear();
    this.bendSemitones = 0;
    this.vibratoEnabled = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.connectedVoices) this.disconnectVoice(voice);
    this.voices.clear();
    this.sampleCache.clear();
    try { this.vibratoOscillator?.stop(); } catch { /* already stopped */ }
    this.vibratoOscillator?.disconnect();
    this.disconnectOutput?.();
    this.disconnectOutput = null;
    this.master?.disconnect();
    if (this.context && this.context.state !== "closed") {
      void this.context.close().catch(() => {});
    }
    this.context = null;
    this.master = null;
    this.vibratoOscillator = null;
  }

  private getContext(): AudioContext | null {
    if (this.context) return this.context;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext({ latencyHint: "interactive" });
      const master = context.createGain();
      master.gain.value = 0.46;
      this.disconnectOutput = connectAudioOutput(context, master);

      const vibratoOscillator = context.createOscillator();
      vibratoOscillator.type = "sine";
      vibratoOscillator.frequency.value = 5.6;
      vibratoOscillator.start();

      this.context = context;
      this.master = master;
      this.vibratoOscillator = vibratoOscillator;
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

  private getSample(context: AudioContext, stringIndex: number, fret: number): PluckSample {
    const key = stringIndex + ":" + fret;
    const cached = this.sampleCache.get(key);
    if (cached) {
      // Map insertion order acts as a small LRU cache.
      this.sampleCache.delete(key);
      this.sampleCache.set(key, cached);
      return cached;
    }

    const midi = OPEN_STRING_MIDI[stringIndex] + fret;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const sampleRate = context.sampleRate;
    const ringLength = Math.max(2, Math.round(sampleRate / frequency - 0.5));
    const ring = new Float32Array(ringLength);
    const noiseMix = 0.26 + stringIndex * 0.025;
    const pickPosition = 0.24;
    let mean = 0;

    for (let i = 0; i < ringLength; i += 1) {
      const position = i / ringLength;
      const triangle = position < pickPosition
        ? position / pickPosition
        : (1 - position) / (1 - pickPosition);
      const value = (triangle * 2 - 1) * (1 - noiseMix)
        + (Math.random() * 2 - 1) * noiseMix;
      ring[i] = value;
      mean += value;
    }
    mean /= ringLength;
    for (let i = 0; i < ringLength; i += 1) ring[i] -= mean;

    const sampleCount = Math.ceil(sampleRate * SAMPLE_SECONDS);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const output = buffer.getChannelData(0);
    // The averaging step damps higher partials; this factor sets the broad
    // natural decay independently of pitch. A simple high-pass removes DC.
    const damping = Math.exp(-6.9 / (frequency * 8.2));
    const toneAlpha = 0.34 + stringIndex * 0.052;
    const tailSamples = Math.floor(sampleRate * 0.16);
    let ringIndex = 0;
    let lowPass = 0;
    let previousLowPass = 0;
    let highPass = 0;

    for (let i = 0; i < sampleCount; i += 1) {
      const current = ring[ringIndex];
      const nextIndex = ringIndex + 1 === ringLength ? 0 : ringIndex + 1;
      ring[ringIndex] = (current + ring[nextIndex]) * 0.5 * damping;
      ringIndex = nextIndex;

      lowPass += toneAlpha * (current - lowPass);
      highPass = lowPass - previousLowPass + 0.998 * highPass;
      previousLowPass = lowPass;
      const remaining = sampleCount - i;
      const tail = remaining < tailSamples ? remaining / tailSamples : 1;
      output[i] = highPass * tail;
    }

    // The averaging loop contributes roughly half a sample of phase delay.
    const actualFrequency = sampleRate / (ringLength + 0.5);
    const sample = { buffer, basePlaybackRate: frequency / actualFrequency };
    this.sampleCache.set(key, sample);
    if (this.sampleCache.size > CACHE_LIMIT) {
      const oldest = this.sampleCache.keys().next().value;
      if (oldest !== undefined) this.sampleCache.delete(oldest);
    }
    return sample;
  }

  private bendRatio(): number {
    return 2 ** (this.bendSemitones / 12);
  }

  private stopVoiceImmediately(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    this.silenceVoice(voice);
  }

  private silenceVoice(voice: Voice): void {
    if (voice.disconnected) return;
    const now = this.context?.currentTime ?? 0;
    if (now < voice.startTime) {
      try { voice.source.stop(now); } catch { /* already stopped */ }
      this.disconnectVoice(voice);
      return;
    }

    voice.envelope.gain.cancelAndHoldAtTime(now);
    voice.envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
    try { voice.source.stop(now + 0.03); } catch { /* already ended */ }
  }

  private disconnectVoice(voice: Voice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    this.connectedVoices.delete(voice);
    this.vibratoOscillator?.disconnect(voice.vibratoDepth);
    voice.source.disconnect();
    voice.envelope.disconnect();
    voice.vibratoDepth.disconnect();
  }
}
