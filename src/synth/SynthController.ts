import { SynthAudioEngine } from "../audio/SynthAudioEngine";
import { MAX_SYNTH_OCTAVE, MIN_SYNTH_OCTAVE, PLUCK_PRESET, SYNTH_KEYS, synthMidi } from "./model";
import type { SynthSettings } from "./model";

type SynthNote = { id: string; midi: number };
export type SynthSnapshot = {
  note: SynthNote | null;
  octave: number;
  settings: SynthSettings;
  hasPlayed: boolean;
  audioUnavailable: boolean;
};

export class SynthController {
  private readonly engine = new SynthAudioEngine((id) => {
    if (this.note?.id === id) { this.note = null; this.publish(); }
  });
  private readonly listeners = new Set<() => void>();
  private readonly heldSources = new Map<string, string>();
  private readonly pressed = new Set<string>();
  private readonly taps = new Set<ReturnType<typeof setTimeout>>();
  private serial = 0;
  private note: SynthNote | null = null;
  private octave = 3;
  private settings = { ...PLUCK_PRESET };
  private hasPlayed = false;
  private audioUnavailable = false;
  private snapshot: SynthSnapshot = {
    note: null, octave: 3, settings: { ...PLUCK_PRESET }, hasPlayed: false, audioUnavailable: false,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): SynthSnapshot => this.snapshot;

  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.stopAll);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.stopAll);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.stopAll();
    this.engine.dispose();
  }

  press(source: string, offset: number): void {
    if (this.heldSources.has(source) || !SYNTH_KEYS.some((key) => key.offset === offset)) return;
    const id = `synth-${++this.serial}`;
    const midi = synthMidi(offset, this.octave);
    if (!this.engine.play(id, midi, this.settings)) {
      this.audioUnavailable = true;
      this.publish();
      return;
    }
    this.heldSources.set(source, id);
    this.note = { id, midi };
    this.hasPlayed = true;
    this.audioUnavailable = false;
    this.publish();
  }

  release(source: string): void {
    const id = this.heldSources.get(source);
    if (!id) return;
    this.heldSources.delete(source);
    this.engine.release(id);
  }

  tap(offset: number): void {
    const source = `tap-${++this.serial}`;
    this.press(source, offset);
    const timer = setTimeout(() => { this.taps.delete(timer); this.release(source); }, 220);
    this.taps.add(timer);
  }

  shiftOctave(delta: number): void {
    const next = Math.max(MIN_SYNTH_OCTAVE, Math.min(MAX_SYNTH_OCTAVE, this.octave + delta));
    if (next === this.octave) return;
    this.stopAll();
    this.octave = next;
    this.publish();
  }

  setSetting(key: keyof SynthSettings, value: number): void {
    if (!Number.isFinite(value)) return;
    const bounds = key === "decay" ? [100, 1000] : key === "echo" ? [0, 35] : [0, 100];
    this.settings = { ...this.settings, [key]: Math.max(bounds[0], Math.min(bounds[1], value)) };
    this.publish();
  }

  resetPreset(): void {
    this.stopAll();
    this.settings = { ...PLUCK_PRESET };
    this.octave = 3;
    this.publish();
  }

  stopAll = (): void => {
    this.engine.stopAll();
    for (const timer of this.taps) clearTimeout(timer);
    this.taps.clear();
    this.heldSources.clear();
    this.pressed.clear();
    this.note = null;
    this.publish();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (event.code === "Escape") { event.preventDefault(); this.stopAll(); return; }
    if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
    const key = SYNTH_KEYS.find((item) => item.code === event.code);
    if (!key && !["ArrowLeft", "ArrowRight"].includes(event.code)) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code);
    if (key) this.press(`keyboard-${event.code}`, key.offset);
    if (event.code === "ArrowLeft") this.shiftOctave(-1);
    if (event.code === "ArrowRight") this.shiftOctave(1);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (!this.pressed.delete(event.code)) return;
    event.preventDefault();
    this.release(`keyboard-${event.code}`);
  };
  private onVisibilityChange = (): void => { if (document.hidden) this.stopAll(); };
  private publish(): void {
    this.snapshot = {
      note: this.note, octave: this.octave, settings: this.settings,
      hasPlayed: this.hasPlayed, audioUnavailable: this.audioUnavailable,
    };
    for (const listener of this.listeners) listener();
  }
}
