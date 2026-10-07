import { STOP_SOUND_EVENT } from "../studioEvents";
import { isRangeShortcut, readOctave, readRangeShortcuts, writePreference } from "../preferences";
import type { RangeShortcuts } from "../preferences";
import { publishPerformance } from "../practice/events";
import { HarmoniumAudioEngine } from "../audio/HarmoniumAudioEngine";
import { HingeInput } from "./HingeInput";
import type { HingeReading, HingeStatus } from "./HingeInput";
import {
  AIR_DECAY_RATE, AIR_PER_DEGREE, HARMONIUM_KEYS, MANUAL_PUMP_RATE,
  MAX_OCTAVE, MIN_OCTAVE, START_OCTAVE, STEADY_PRESSURE, DEFAULT_SENSITIVITY, harmoniumMidi,
} from "./model";
import type { AirRetention, BellowsMode } from "./model";

type Calibration = { kind: "idle" | "running" | "complete" | "insufficient"; travel: number; progress: number };
const SETTINGS_KEY = "nerdboard-harmonium-bellows-v1";
function readSettings(): { sensitivity: number; retention: AirRetention } {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (value && typeof value === "object") {
      const settings = value as Record<string, unknown>;
      return {
        sensitivity: typeof settings.sensitivity === "number" && Number.isFinite(settings.sensitivity)
          ? Math.max(0.5, Math.min(6, settings.sensitivity)) : DEFAULT_SENSITIVITY,
        retention: settings.retention === "natural" ? "natural" : "smooth",
      };
    }
  } catch { /* Preferences are optional when browser storage is unavailable. */ }
  return { sensitivity: DEFAULT_SENSITIVITY, retention: "smooth" };
}

type HeldNote = { id: string; midi: number };
export type HarmoniumSnapshot = {
  notes: HeldNote[];
  octave: number;
  shortcuts: RangeShortcuts;
  pressure: number;
  mode: BellowsMode;
  pumping: boolean;
  hasPlayed: boolean;
  audioUnavailable: boolean;
  hinge: HingeStatus;
  reading: HingeReading | null;
  readingAgeMs: number | null;
  movementDetected: boolean;
  sensitivity: number;
  retention: AirRetention;
  calibration: Calibration;
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
  private octave = readOctave("harmonium", START_OCTAVE, MIN_OCTAVE, MAX_OCTAVE);
  private shortcuts = readRangeShortcuts("harmonium");
  private pressure = 0;
  private mode: BellowsMode = "manual";
  private hasPlayed = false;
  private audioUnavailable = false;
  private hinge: HingeStatus = { kind: "idle", message: "Connect a compatible MacBook lid sensor to try hinge bellows." };
  private reading: HingeReading | null = null;
  private previousAngle: HingeReading | null = null;
  private readonly settings = readSettings();
  private sensitivity = this.settings.sensitivity;
  private retention = this.settings.retention;
  private movementDetected = false;
  private calibration: Calibration = { kind: "idle", travel: 0, progress: 0 };
  private calibrationStartedAt = 0;
  private calibrationChanges = 0;
  private calibrationDirection = 0;
  private calibrationStrokes = 1;
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
    window.addEventListener(STOP_SOUND_EVENT, this.stopAll);
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
    window.removeEventListener(STOP_SOUND_EVENT, this.stopAll);
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
    if (!source.startsWith("demo-")) publishPerformance("harmonium", String(midi));
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
    this.movementDetected = false;
    this.cancelCalibration();
    this.hingeInput?.disconnect();
    this.publish();
  };

  setSensitivity(value: number): void {
    if (!Number.isFinite(value)) return;
    this.sensitivity = Math.max(0.5, Math.min(6, value));
    this.saveSettings();
    this.publish();
  }
  setRetention(value: AirRetention): void {
    if (value !== "natural" && value !== "smooth") return;
    this.retention = value;
    this.saveSettings();
    this.publish();
  }
  beginCalibration(): void {
    if (this.hinge.kind !== "connected") return;
    this.calibrationStartedAt = performance.now();
    this.calibrationChanges = 0;
    this.calibrationDirection = 0;
    this.calibrationStrokes = 1;
    this.calibration = { kind: "running", travel: 0, progress: 0 };
    this.publish();
  }
  cancelCalibration(): void {
    if (this.calibration.kind === "running") {
      this.calibration = { kind: "idle", travel: 0, progress: 0 };
      this.publish();
    }
  }
  private saveSettings(): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sensitivity: this.sensitivity, retention: this.retention })); }
    catch { /* Playing works without saved preferences. */ }
  }

  setShortcut(direction: keyof RangeShortcuts, code: RangeShortcuts["lower"]): void {
    if (!isRangeShortcut(code) || code === this.shortcuts[direction === "lower" ? "higher" : "lower"]) return;
    this.shortcuts = { ...this.shortcuts, [direction]: code };
    writePreference("harmonium:shortcuts", this.shortcuts);
    this.publish();
  }
  shiftOctave(delta: number): void { this.setOctave(this.octave + delta); }
  setOctave(value: number): void {
    if (!Number.isInteger(value)) return;
    const next = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, value));
    if (next === this.octave) return;
    this.octave = next;
    writePreference("harmonium:octave", next);
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
    this.cancelCalibration();
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
      const decay = this.retention === "smooth" ? AIR_DECAY_RATE * 0.6 : AIR_DECAY_RATE;
      this.setPressure(this.pressure + (pump - decay - noteCount * 0.012) * dt);
    }
    if (this.calibration.kind === "running") {
      const progress = Math.min(1, (now - this.calibrationStartedAt) / 8000);
      this.calibration = { ...this.calibration, progress };
      if (progress === 1) {
        if (this.calibration.travel >= 4 && this.calibrationChanges >= 3) {
          const averageStroke = this.calibration.travel / this.calibrationStrokes;
          this.sensitivity = Math.max(0.5, Math.min(6, 0.7 / (averageStroke * AIR_PER_DEGREE)));
          this.saveSettings();
          this.calibration = { ...this.calibration, kind: "complete" };
        } else this.calibration = { ...this.calibration, kind: "insufficient" };
      }
      this.publish();
    }
    const age = this.reading ? now - this.reading.timestamp : null;
    if (Math.abs(this.snapshot.pressure - this.pressure) > 0.002 ||
      (this.snapshot.pressure !== this.pressure && (this.pressure === 0 || this.pressure === 1)) ||
      (age !== null && Math.floor(age / 250) !== Math.floor((this.snapshot.readingAgeMs ?? 0) / 250))) this.publish();
  };

  private onReading(reading: HingeReading): void {
    if (!this.attached) return;
    this.reading = reading;
    if (!document.hidden && this.previousAngle) {
      const gap = reading.timestamp - this.previousAngle.timestamp;
      // Integrate distance once per actual sample; never invent readings between reports.
      const delta = reading.angle - this.previousAngle.angle;
      if (gap > 0 && gap < 2000 && delta !== 0) {
        this.movementDetected = true;
        if (this.mode === "hinge") this.setPressure(this.pressure + Math.abs(delta) * AIR_PER_DEGREE * this.sensitivity);
        if (this.calibration.kind === "running") {
          const direction = Math.sign(delta);
          if (this.calibrationDirection && direction !== this.calibrationDirection) this.calibrationStrokes += 1;
          this.calibrationDirection = direction;
          this.calibrationChanges += 1;
          this.calibration = { ...this.calibration, travel: this.calibration.travel + Math.abs(delta) };
        }
      }
    }
    this.previousAngle = document.hidden ? null : reading;
    this.publish();
  }

  private onHingeStatus(status: HingeStatus): void {
    const selectHinge = this.selectHingeAfterConnection && this.attached && !document.hidden;
    if (status.kind !== "connecting") this.selectHingeAfterConnection = false;
    this.hinge = status;
    this.movementDetected = false;
    this.cancelCalibration();
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
    if (event.target instanceof HTMLElement && event.target.closest("dialog[open]")) return;
    if (event.code === "Escape") { event.preventDefault(); this.stopAll(); return; }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
    const key = HARMONIUM_KEYS.find((item) => item.code === event.code);
    if (!key && !["Space", "ArrowLeft", "ArrowRight", this.shortcuts.lower, this.shortcuts.higher].includes(event.code)) return;
    if (event.code === "Space" && target instanceof HTMLElement && target.closest("button, a")) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code);
    if (key) this.press(`keyboard-${event.code}`, key.offset);
    if (event.code === "Space") this.startPump("keyboard-space");
    if (event.code === "ArrowLeft" || event.code === this.shortcuts.lower) this.shiftOctave(-1);
    if (event.code === "ArrowRight" || event.code === this.shortcuts.higher) this.shiftOctave(1);
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
      notes: [...this.notes.values()], octave: this.octave, shortcuts: this.shortcuts, pressure: this.pressure,
      mode: this.mode, pumping: this.pumps.size > 0, hasPlayed: this.hasPlayed,
      audioUnavailable: this.audioUnavailable, hinge: this.hinge, reading: this.reading,
      movementDetected: this.movementDetected, sensitivity: this.sensitivity, retention: this.retention, calibration: this.calibration,
      readingAgeMs: this.reading ? Math.max(0, performance.now() - this.reading.timestamp) : null,
    };
  }
  private publish(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }
}
