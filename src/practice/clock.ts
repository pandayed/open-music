import { connectAudioOutput } from "../audio/output";

/** Look ahead on a short timer, then let Web Audio place clicks on its own clock. */
export class PracticeClock {
  private context: AudioContext | null = null;
  private disconnectOutput: (() => void) | null = null;
  private bus: GainNode | null = null;
  private readonly clicks = new Set<OscillatorNode>();
  private timer: number | null = null;

  async activate(): Promise<boolean> {
    try {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.bus = this.context.createGain();
      this.bus.gain.value = 0.15;
      this.disconnectOutput = connectAudioOutput(this.context, this.bus);
      await this.context.resume();
      return this.context.state === "running";
    } catch { this.dispose(); return false; }
  }

  start(bpm: number, firstClickAt: number, enabled: boolean, countIn = 4): void {
    const context = this.context;
    const bus = this.bus;
    if (!context || !bus) return;
    const beatMs = 60000 / bpm;
    let beat = 0;
    let nextAt = context.currentTime + Math.max(0, firstClickAt - performance.now()) / 1000;
    const tick = () => {
      if (context.state !== "running") return;
      while (nextAt < context.currentTime + 0.12) {
        if ((enabled || beat < countIn) && nextAt >= context.currentTime) {
          const click = context.createOscillator();
          const envelope = context.createGain();
          click.frequency.value = beat % 4 === 0 ? 1100 : 760;
          envelope.gain.setValueAtTime(0, nextAt);
          envelope.gain.linearRampToValueAtTime(0.6, nextAt + 0.002);
          envelope.gain.exponentialRampToValueAtTime(0.0001, nextAt + 0.045);
          click.connect(envelope).connect(bus);
          this.clicks.add(click);
          click.onended = () => { this.clicks.delete(click); click.disconnect(); envelope.disconnect(); };
          click.start(nextAt);
          click.stop(nextAt + 0.05);
        }
        nextAt += beatMs / 1000;
        beat += 1;
      }
    };
    tick();
    this.timer = window.setInterval(tick, 25);
  }

  dispose(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const click of this.clicks) {
      click.onended = null;
      try { click.stop(); } catch { /* Already stopped. */ }
      click.disconnect();
    }
    this.clicks.clear();
    this.disconnectOutput?.();
    this.disconnectOutput = null;
    this.bus?.disconnect();
    this.bus = null;
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.context = null;
  }
}
