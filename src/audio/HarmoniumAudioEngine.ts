// All 17 displayed pitches can be held, with room for bounded release tails.
const VOICE_LIMIT = 24;
const VOICE_GAIN = 0.12;
const MASTER_GAIN = 0.58;
const ATTACK_SECONDS = 0.035;
const RELEASE_SECONDS = 0.1;
const PRESSURE_SMOOTHING_SECONDS = 0.035;

type HarmoniumVoice = {
  id: string;
  startedAt: number;
  oscillators: OscillatorNode[];
  nodes: AudioNode[];
  envelope: GainNode;
  disconnected: boolean;
};

/** Original sustained reed synthesis: bellows pressure controls the shared air supply. */
export class HarmoniumAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private reedWave: PeriodicWave | null = null;
  private resumeRequestedContext: AudioContext | null = null;
  private pressure = 0;
  private readonly voices = new Map<string, HarmoniumVoice>();
  private readonly connectedVoices = new Set<HarmoniumVoice>();

  play(id: string, midi: number): boolean {
    if (!Number.isInteger(midi) || midi < 21 || midi > 108) return false;
    // Context creation and resume stay directly inside the note's user gesture.
    const context = this.getContext();
    if (!context || !this.master || !this.reedWave || context.state === "closed") return false;
    this.resumeContext(context);

    const previous = this.voices.get(id);
    if (previous) this.disconnectVoice(previous);
    if (this.connectedVoices.size >= VOICE_LIMIT) {
      // Released tails count toward the limit; retire a tail before a held note.
      const oldest = [...this.connectedVoices].find((voice) => this.voices.get(voice.id) !== voice)
        ?? this.connectedVoices.values().next().value;
      if (oldest) this.disconnectVoice(oldest);
    }

    let voice: HarmoniumVoice | null = null;
    try {
      const now = context.currentTime;
      const envelope = context.createGain();
      voice = { id, startedAt: now, oscillators: [], nodes: [envelope], envelope, disconnected: false };
      this.connectedVoices.add(voice);
      const filter = context.createBiquadFilter();
      voice.nodes.push(filter);
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      filter.type = "lowpass";
      filter.frequency.value = Math.min(context.sampleRate * 0.4, Math.max(1800, frequency * 9));
      filter.Q.value = 0.5;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(VOICE_GAIN, now + ATTACK_SECONDS);
      filter.connect(envelope).connect(this.master);

      // Two reeds give a gentle beating tone. Web Audio bandlimits the harmonics.
      for (const [level, detune] of [[0.68, -1.8], [0.32, 1.8]]) {
        const oscillator = context.createOscillator();
        voice.oscillators.push(oscillator);
        const gain = context.createGain();
        voice.nodes.push(gain);
        oscillator.setPeriodicWave(this.reedWave);
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;
        gain.gain.value = level;
        oscillator.connect(gain).connect(filter);
      }
      const startedVoice = voice;
      voice.oscillators[0].onended = () => this.disconnectVoice(startedVoice);
      this.voices.set(id, voice);
      for (const oscillator of voice.oscillators) oscillator.start(now);
      return true;
    } catch {
      if (voice) this.disconnectVoice(voice);
      return false;
    }
  }

  release(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    this.voices.delete(id);
    const context = this.context;
    if (!context || context.state !== "running") {
      this.disconnectVoice(voice);
      return;
    }
    const now = context.currentTime;
    // Preserve the current short attack level when releasing a very quick tap.
    const level = VOICE_GAIN * Math.min(1, Math.max(0, (now - voice.startedAt) / ATTACK_SECONDS));
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setValueAtTime(level, now);
    voice.envelope.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);
    for (const oscillator of voice.oscillators) {
      try { oscillator.stop(now + RELEASE_SECONDS + 0.01); } catch { /* already ended */ }
    }
  }

  setPressure(value: number): void {
    this.pressure = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const context = this.context;
    if (!context || !this.master || context.state === "closed") return;
    const now = context.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(this.pressure * MASTER_GAIN, now, PRESSURE_SMOOTHING_SECONDS);
  }

  stopAll(): void {
    this.voices.clear();
    // Include release tails and disconnect immediately, even in a suspended context.
    for (const voice of [...this.connectedVoices]) this.disconnectVoice(voice);
  }

  dispose(): void {
    this.stopAll();
    this.master?.disconnect();
    this.limiter?.disconnect();
    const context = this.context;
    this.context = null;
    this.master = null;
    this.limiter = null;
    this.reedWave = null;
    this.resumeRequestedContext = null;
    if (context && context.state !== "closed") void context.close().catch(() => {});
    // A later play may recreate the graph after React reattaches this controller.
  }

  private getContext(): AudioContext | null {
    if (this.context && this.context.state !== "closed") return this.context;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext({ latencyHint: "interactive" });
      const master = context.createGain();
      master.gain.value = this.pressure * MASTER_GAIN;
      const limiter = context.createWaveShaper();
      const curve = new Float32Array(1025);
      for (let i = 0; i < curve.length; i += 1) {
        const value = i * 2 / (curve.length - 1) - 1;
        const magnitude = Math.abs(value);
        curve[i] = magnitude <= 0.55 ? value
          : Math.sign(value) * (0.55 + 0.27 * Math.tanh((magnitude - 0.55) / 0.27));
      }
      limiter.curve = curve;
      master.connect(limiter).connect(context.destination);
      const real = new Float32Array(13);
      const imag = new Float32Array([0, 1, 0.52, 0.34, 0.18, 0.14, 0.1, 0.085, 0.06, 0.035, 0.025, 0.018, 0.012]);
      const reedWave = context.createPeriodicWave(real, imag);
      this.context = context;
      this.master = master;
      this.limiter = limiter;
      this.reedWave = reedWave;
      return context;
    } catch {
      if (context) void context.close().catch(() => {});
      return null;
    }
  }

  private resumeContext(context: AudioContext): void {
    if (context.state !== "suspended" || this.resumeRequestedContext === context) return;
    this.resumeRequestedContext = context;
    void context.resume().catch(() => {}).finally(() => {
      if (this.resumeRequestedContext === context) this.resumeRequestedContext = null;
    });
  }

  private disconnectVoice(voice: HarmoniumVoice): void {
    if (voice.disconnected) return;
    voice.disconnected = true;
    if (this.voices.get(voice.id) === voice) this.voices.delete(voice.id);
    this.connectedVoices.delete(voice);
    for (const oscillator of voice.oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* ended or not started */ }
      oscillator.disconnect();
    }
    for (const node of voice.nodes) node.disconnect();
  }
}
