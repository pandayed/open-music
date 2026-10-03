import { HarmoniumAudioEngine } from "../audio/HarmoniumAudioEngine";
import { HingeInput } from "./HingeInput";
import type { HingeReading, HingeStatus } from "./HingeInput";
import {
  AIR_DECAY_RATE, AIR_PER_DEGREE, HARMONIUM_KEYS, MANUAL_PUMP_RATE,
  MAX_OCTAVE, MIN_OCTAVE, START_OCTAVE, STEADY_PRESSURE, harmoniumMidi,
} from "./model";
import type { BellowsMode } from "./model";

type HeldNote = { id: string; midi: number };
export type HarmoniumSnapshot = {
  notes: HeldNote[];
  octave: number;
  pressure: number;
  mode: BellowsMode;
  pumping: boolean;
  hasPlayed: boolean;
  audioUnavailable: boolean;
  hinge: HingeStatus;
  reading: HingeReading | null;
  readingAgeMs: number | null;
};

/** Keeps air separate from note holds: no air means silence, even with keys held. */
export class HarmoniumController {
  private readonly engine = new HarmoniumAudioEngine();
  private readonly listeners = new Set<() => void>();
  private readonly notes = new Map<string, HeldNote>();
  private readonly pressed = new Set<string>();
  private readonly pumps = new Set<string>();
  private readonly taps = new Set<ReturnType<typeof setTimeout>>();
  private hingeInput: HingeInput | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private attached = false;
  private selectHingeAfterConnection = false;
  private lastTick = 0;
  private serial = 0;
  private octave = START_OCTAVE;
  private pressure = 0;
  private mode: BellowsMode = "manual";
  private hasPlayed = false;
  private audioUnavailable = false;
  private hinge: HingeStatus = { kind: "idle", message: "Connect a compatible MacBook lid sensor to try hinge bellows." };
  private reading: HingeReading | null = null;
  private previousAngle: HingeReading | null = null;
  private snapshot: HarmoniumSnapshot = this.createSnapshot();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): HarmoniumSnapshot => this.snapshot;

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.hingeInput = new HingeInput(
      (reading) => this.onReading(reading),
      (status) => this.onHingeStatus(status),
    );
    this.hinge = { kind: "idle", message: "Connect a compatible MacBook lid sensor to try hinge bellows." };
    this.reading = null;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.pause);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    const unavailable = HingeInput.availability();
    if (unavailable) this.hinge = { kind: "unavailable", message: unavailable };
    this.lastTick = performance.now();
    this.timer = setInterval(this.tick, 33);
    this.publish();
  }

  dispose(): void {
    this.attached = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.pause);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stopAll();
    this.hingeInput?.dispose();
    this.hingeInput = null;
    this.engine.dispose();
  }

  press(source: string, offset: number): void {
    if (!this.attached || this.notes.has(source) || !HARMONIUM_KEYS.some((key) => key.offset === offset)) return;
    const midi = harmoniumMidi(offset, this.octave);
    // Share a voice when keyboard and pointer hold the same pitch.
    const existing = [...this.notes.values()].find((note) => note.midi === midi);
    const id = existing?.id ?? `harmonium-${++this.serial}`;
    if (!existing && !this.engine.play(id, midi)) {
      this.audioUnavailable = true;
      this.publish();
      return;
    }
    this.audioUnavailable = false;
    this.hasPlayed = true;
    this.notes.set(source, { id, midi });
    this.publish();
  }

  release(source: string): void {
    const note = this.notes.get(source);
    if (!note) return;
    this.notes.delete(source);
    if (![...this.notes.values()].some((other) => other.id === note.id)) this.engine.release(note.id);
    this.publish();
  }

  tap(offset: number): void {
    const source = `tap-${++this.serial}`;
    this.press(source, offset);
    const timer = setTimeout(() => { this.taps.delete(timer); this.release(source); }, 240);
    this.taps.add(timer);
  }

  startPump(source: string): void {
    if (!this.attached || this.mode !== "manual") return;
    this.pumps.add(source);
    this.publish();
  }
  endPump(source: string): void { this.pumps.delete(source); this.publish(); }
  pumpOnce(): void {
    if (this.mode !== "manual") return;
    this.setPressure(this.pressure + 0.35);
    this.publish();
  }

  setMode(mode: BellowsMode): void {
    if (mode === "hinge" && this.hinge.kind !== "connected") return;
    this.selectHingeAfterConnection = false;
    this.pumps.clear();
    this.previousAngle = null;
    this.mode = mode;
    this.setPressure(mode === "steady" ? STEADY_PRESSURE : 0);
    this.publish();
  }

  connectHinge = (): void => {
    if (!this.attached || !this.hingeInput || ["connecting", "connected", "unavailable"].includes(this.hinge.kind)) return;
    this.selectHingeAfterConnection = true;
    void this.hingeInput.connect();
  };
  disconnectHinge = (): void => {
    if (this.mode === "hinge") this.setMode("manual");
    this.reading = null;
    this.previousAngle = null;
    this.hingeInput?.disconnect();
    this.publish();
  };

  shiftOctave(delta: number): void {
    const next = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, this.octave + delta));
    if (next === this.octave) return;
    this.clearNotes();
    this.octave = next;
    this.publish();
  }

  stopAll = (): void => {
    // An explicit stop must also win over an outstanding chooser/open completion.
    this.selectHingeAfterConnection = false;
    this.pause();
  };

  private pause = (): void => {
    // A native device chooser can blur the page: silence notes but keep its intent.
    this.clearNotes();
    this.pumps.clear();
    this.pressed.clear();
    this.previousAngle = null;
    this.mode = "manual";
    this.setPressure(0);
    this.publish();
  };

  private clearNotes(): void {
    this.engine.stopAll();
    this.notes.clear();
    for (const timer of this.taps) clearTimeout(timer);
    this.taps.clear();
  }

  private tick = (): void => {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    if (document.hidden) return;
    if (this.mode === "steady") this.setPressure(STEADY_PRESSURE);
    else {
      const pump = this.mode === "manual" && this.pumps.size ? MANUAL_PUMP_RATE : 0;
      const noteCount = new Set([...this.notes.values()].map((note) => note.midi)).size;
      this.setPressure(this.pressure + (pump - AIR_DECAY_RATE - noteCount * 0.015) * dt);
    }
    const age = this.reading ? now - this.reading.timestamp : null;
    if (Math.abs(this.snapshot.pressure - this.pressure) > 0.002 ||
      (this.snapshot.pressure !== this.pressure && (this.pressure === 0 || this.pressure === 1)) ||
      (age !== null && Math.floor(age / 250) !== Math.floor((this.snapshot.readingAgeMs ?? 0) / 250))) this.publish();
  };

  private onReading(reading: HingeReading): void {
    if (!this.attached) return;
    this.reading = reading;
    if (this.mode === "hinge" && !document.hidden && this.previousAngle) {
      const gap = reading.timestamp - this.previousAngle.timestamp;
      // Integrate distance once per actual sample; never invent readings between reports.
      if (gap > 0 && gap < 2000) this.setPressure(this.pressure + Math.abs(reading.angle - this.previousAngle.angle) * AIR_PER_DEGREE);
    }
    this.previousAngle = document.hidden ? null : reading;
    this.publish();
  }

  private onHingeStatus(status: HingeStatus): void {
    const selectHinge = this.selectHingeAfterConnection && this.attached && !document.hidden;
    if (status.kind !== "connecting") this.selectHingeAfterConnection = false;
    this.hinge = status;
    this.reading = null;
    this.previousAngle = null;
    if (status.kind === "connected" && selectHinge) this.setMode("hinge");
    else if (this.mode === "hinge") this.setMode("manual");
    this.publish();
  }

  private setPressure(value: number): void {
    const next = Math.max(0, Math.min(1, value));
    if (next === this.pressure) return;
    this.pressure = next;
    this.engine.setPressure(this.pressure);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === "Escape") { event.preventDefault(); this.stopAll(); return; }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
    const key = HARMONIUM_KEYS.find((item) => item.code === event.code);
    if (!key && !["Space", "ArrowLeft", "ArrowRight"].includes(event.code)) return;
    if (event.code === "Space" && target instanceof HTMLElement && target.closest("button, a")) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code);
    if (key) this.press(`keyboard-${event.code}`, key.offset);
    if (event.code === "Space") this.startPump("keyboard-space");
    if (event.code === "ArrowLeft") this.shiftOctave(-1);
    if (event.code === "ArrowRight") this.shiftOctave(1);
  };
  private onKeyUp = (event: KeyboardEvent): void => {
    if (!this.pressed.delete(event.code)) return;
    event.preventDefault();
    this.release(`keyboard-${event.code}`);
    if (event.code === "Space") this.endPump("keyboard-space");
  };
  private onVisibilityChange = (): void => { if (document.hidden) this.stopAll(); };
  private createSnapshot(): HarmoniumSnapshot {
    return {
      notes: [...this.notes.values()], octave: this.octave, pressure: this.pressure,
      mode: this.mode, pumping: this.pumps.size > 0, hasPlayed: this.hasPlayed,
      audioUnavailable: this.audioUnavailable, hinge: this.hinge, reading: this.reading,
      readingAgeMs: this.reading ? Math.max(0, performance.now() - this.reading.timestamp) : null,
    };
  }
  private publish(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }
}
