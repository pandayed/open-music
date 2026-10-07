import { STOP_SOUND_EVENT } from "../studioEvents";
import { PianoAudioEngine } from "../audio/PianoAudioEngine";
import { MAX_OCTAVE, MIN_OCTAVE, PIANO_KEYS, pianoMidi, isPianoMidi } from "./model";
import { isRangeShortcut, readOctave, readRangeShortcuts, writePreference } from "../preferences";
import type { RangeShortcuts } from "../preferences";
import { publishPerformance } from "../practice/events";

type PianoNote = { id: string; midi: number; held: boolean };

export type PianoSnapshot = {
  notes: PianoNote[];
  octave: number;
  sustain: boolean;
  hasPlayed: boolean;
  audioUnavailable: boolean;
  shortcuts: RangeShortcuts;
};

/** Owns note holds and the pedal, independently of how a note was pressed. */
export class PianoController {
  private readonly engine = new PianoAudioEngine((id) => this.onVoiceEnd(id));
  private readonly listeners = new Set<() => void>();
  private readonly pressed = new Set<string>();
  private readonly notes = new Map<string, PianoNote>();
  private readonly heldVoices = new Map<string, string>();
  private readonly taps = new Set<ReturnType<typeof setTimeout>>();
  private serial = 0;
  private octave = readOctave("piano", 4, MIN_OCTAVE, MAX_OCTAVE);
  private shortcuts = readRangeShortcuts("piano");
  private pedalHeld = false;
  private pedalLatched = false;
  private hasPlayed = false;
  private audioUnavailable = false;
  private snapshot: PianoSnapshot = {
    notes: [], octave: this.octave, sustain: false, hasPlayed: false, audioUnavailable: false, shortcuts: this.shortcuts,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PianoSnapshot => this.snapshot;

  attach(): void {
    window.addEventListener(STOP_SOUND_EVENT, this.stopAll);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.stopAll);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  dispose(): void {
    window.removeEventListener(STOP_SOUND_EVENT, this.stopAll);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.stopAll);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.stopAll();
    this.engine.dispose();
  }

  press(source: string, offset: number): void {
    if (this.heldVoices.has(source) || !PIANO_KEYS.some((key) => key.offset === offset)) return;
    const midi = pianoMidi(offset, this.octave);
    if (!isPianoMidi(midi)) return;
    const id = `piano-${++this.serial}`;
    if (!this.engine.play(id, midi)) {
      this.audioUnavailable = true;
      this.publish();
      return;
    }
    this.audioUnavailable = false;
    this.hasPlayed = true;
    this.notes.set(id, { id, midi, held: true });
    this.heldVoices.set(source, id);
    if (!source.startsWith("demo-")) publishPerformance("piano", String(midi));
    this.publish();
  }

  release(source: string): void {
    const id = this.heldVoices.get(source);
    if (!id) return;
    this.heldVoices.delete(source);
    const note = this.notes.get(id);
    if (!note) return;
    if (this.sustain) this.notes.set(id, { ...note, held: false });
    else this.releaseVoice(id);
    this.publish();
  }

  // Assistive technology and Enter/Space activate a button as a short note.
  tap(offset: number): void {
    const source = `tap-${++this.serial}`;
    this.press(source, offset);
    const timer = setTimeout(() => {
      this.taps.delete(timer);
      this.release(source);
    }, 220);
    this.taps.add(timer);
  }

  shiftOctave(delta: number): void {
    this.setOctave(this.octave + delta);
  }

  setOctave(octave: number): void {
    if (!Number.isFinite(octave)) return;
    const next = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, Math.round(octave)));
    if (next === this.octave) return;
    this.octave = next;
    writePreference("piano:octave", next);
    this.publish();
  }

  setShortcut(direction: keyof RangeShortcuts, code: RangeShortcuts["lower"]): void {
    if (!isRangeShortcut(code) || this.shortcuts[direction === "lower" ? "higher" : "lower"] === code) return;
    this.shortcuts = { ...this.shortcuts, [direction]: code };
    writePreference("piano:shortcuts", this.shortcuts);
    this.publish();
  }

  toggleSustain(): void {
    this.pedalLatched = !this.pedalLatched;
    this.flushPedal();
  }

  stopAll = (): void => {
    this.engine.stopAll();
    for (const timer of this.taps) clearTimeout(timer);
    this.taps.clear();
    this.pressed.clear();
    this.notes.clear();
    this.heldVoices.clear();
    this.pedalHeld = false;
    this.pedalLatched = false;
    this.publish();
  };

  private get sustain(): boolean { return this.pedalHeld || this.pedalLatched; }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || this.isTextTarget(event.target)) return;
    if (event.code === "Escape") { this.stopAll(); return; }
    const key = PIANO_KEYS.find((item) => item.code === event.code);
    const lower = event.code === this.shortcuts.lower || event.code === "ArrowLeft";
    const higher = event.code === this.shortcuts.higher || event.code === "ArrowRight";
    if (!key && !lower && !higher && event.code !== "Space") return;
    // Space should still activate a focused switch, piano key, or pedal button.
    if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button, a")) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code);
    if (key) this.press(`keyboard-${event.code}`, key.offset);
    if (event.code === "Space") { this.pedalHeld = true; this.flushPedal(); }
    if (lower) this.shiftOctave(-1);
    if (higher) this.shiftOctave(1);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    // Only consume keys whose down event belonged to this instrument.
    if (!this.pressed.delete(event.code)) return;
    event.preventDefault();
    this.release(`keyboard-${event.code}`);
    if (event.code === "Space") { this.pedalHeld = false; this.flushPedal(); }
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.stopAll();
  };

  private flushPedal(): void {
    if (!this.sustain) {
      for (const note of [...this.notes.values()]) {
        if (!note.held) this.releaseVoice(note.id);
      }
    }
    this.publish();
  }

  private releaseVoice(id: string): void {
    this.engine.release(id);
    this.notes.delete(id);
  }

  private onVoiceEnd(id: string): void {
    this.notes.delete(id);
    for (const [source, voiceId] of this.heldVoices) {
      if (voiceId === id) this.heldVoices.delete(source);
    }
    this.publish();
  }

  private publish(): void {
    this.snapshot = {
      notes: [...this.notes.values()], octave: this.octave, sustain: this.sustain,
      hasPlayed: this.hasPlayed, audioUnavailable: this.audioUnavailable,
      shortcuts: this.shortcuts,
    };
    for (const listener of this.listeners) listener();
  }

  private isTextTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }
}
