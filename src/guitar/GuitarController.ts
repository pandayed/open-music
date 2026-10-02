import { GuitarAudioEngine } from "../audio/GuitarAudioEngine";
import { CHORDS, FRETS, STRINGS } from "./model";

export type PlayedNote = {
  id: string;
  stringIndex: number;
  fret: number;
  triggerCode: string;
  shapeCode: string | null;
  startsAt: number;
};

export type GuitarSnapshot = {
  notes: PlayedNote[];
  fretCode: string | null;
  chordCode: string | null;
  bend: number;
  vibrato: boolean;
  hasPlayed: boolean;
  stroke: "down" | "up" | null;
};

/** Translates physical key positions into guitar gestures before audio or UI work. */
export class GuitarController {
  private readonly engine = new GuitarAudioEngine((id) => this.onVoiceEnd(id));
  private readonly listeners = new Set<() => void>();
  private readonly pressed = new Set<string>();
  private readonly heldFrets: string[] = [];
  private readonly heldChords: string[] = [];
  private readonly notes = new Map<string, PlayedNote>();
  private readonly stringVoices = new Map<number, string>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private serial = 0;
  private frame = 0;
  private dragStart: number | null = null;
  private bend = 0;
  private hasPlayed = false;
  private stroke: "down" | "up" | null = null;
  private snapshot: GuitarSnapshot = {
    notes: [], fretCode: null, chordCode: null, bend: 0,
    vibrato: false, hasPlayed: false, stroke: null,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): GuitarSnapshot => this.snapshot;

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
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  startBend(clientX: number): boolean {
    if (!this.notes.size) return false;
    this.dragStart = clientX;
    this.setBend(0);
    return true;
  }

  moveBend(clientX: number): void {
    if (this.dragStart === null) return;
    this.setBend(Math.max(-2, Math.min(2, (clientX - this.dragStart) / 90)));
  }

  endBend(): void {
    this.dragStart = null;
    this.setBend(0);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const { code } = event;
    if (event.metaKey || event.ctrlKey || event.altKey || this.isTextTarget(event.target)) return;
    if (code === "Escape") {
      this.stopAll();
      return;
    }
    if (!this.isMapped(code)) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(code)) return;
    this.pressed.add(code);

    const fret = FRETS.find((item) => item.code === code);
    const chord = CHORDS.find((item) => item.code === code);
    const stringIndex = STRINGS.findIndex((item) => item.code === code);

    if (fret) this.heldFrets.push(code);
    if (chord) this.heldChords.push(code);
    if (stringIndex !== -1) this.pluck(stringIndex, code);
    if (code === "Space") this.strum(event.shiftKey);
    if (code === "KeyH") this.engine.setVibrato(true);
    this.publish();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const { code } = event;
    if (!this.isMapped(code)) return;
    event.preventDefault();
    this.pressed.delete(code);
    this.removeHeld(this.heldFrets, code);
    this.removeHeld(this.heldChords, code);

    for (const note of [...this.notes.values()]) {
      if (note.triggerCode === code || note.shapeCode === code) this.releaseNote(note.id);
    }
    if (code === "KeyH") this.engine.setVibrato(false);
    if (code === "Space") this.stroke = null;
    this.publish();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.stopAll();
  };

  private stopAll = (): void => {
    this.engine.stopAll();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.pressed.clear();
    this.heldFrets.length = 0;
    this.heldChords.length = 0;
    this.notes.clear();
    this.stringVoices.clear();
    this.stroke = null;
    this.endBend();
    this.publish();
  };

  private pluck(stringIndex: number, triggerCode: string, delaySeconds = 0): void {
    const chordCode = this.heldChords.at(-1) ?? null;
    const fretCode = this.heldFrets.at(-1) ?? null;
    const chord = CHORDS.find((item) => item.code === chordCode);
    const fret = chord
      ? chord.frets[stringIndex]
      : (FRETS.find((item) => item.code === fretCode)?.fret ?? 0);
    if (fret < 0) return;

    const oldId = this.stringVoices.get(stringIndex);
    if (oldId) this.releaseNote(oldId);
    const id = `voice-${++this.serial}`;
    const note: PlayedNote = {
      id, stringIndex, fret, triggerCode,
      shapeCode: chordCode ?? fretCode,
      startsAt: performance.now() + delaySeconds * 1000,
    };
    this.notes.set(id, note);
    this.stringVoices.set(stringIndex, id);
    this.engine.play(id, stringIndex, fret, delaySeconds);
    this.hasPlayed = true;

    if (delaySeconds > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.publish();
      }, delaySeconds * 1000);
      this.timers.add(timer);
    }
    this.publish();
  }

  private strum(upstroke: boolean): void {
    this.stroke = upstroke ? "up" : "down";
    const order = upstroke ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    order.forEach((stringIndex, index) => this.pluck(stringIndex, "Space", index * 0.019));
  }

  private releaseNote(id: string): void {
    const note = this.notes.get(id);
    if (!note) return;
    this.engine.release(id);
    this.notes.delete(id);
    if (this.stringVoices.get(note.stringIndex) === id) this.stringVoices.delete(note.stringIndex);
    if (!this.notes.size) this.endBend();
  }

  private onVoiceEnd(id: string): void {
    const note = this.notes.get(id);
    if (!note) return;
    this.notes.delete(id);
    if (this.stringVoices.get(note.stringIndex) === id) this.stringVoices.delete(note.stringIndex);
    if (!this.notes.size) this.endBend();
    this.publish();
  }

  private setBend(semitones: number): void {
    if (this.bend === semitones) return;
    this.bend = semitones;
    this.engine.setBend(semitones);
    this.publish();
  }

  private publish(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const now = performance.now();
      this.snapshot = {
        notes: [...this.notes.values()].filter((note) => note.startsAt <= now),
        fretCode: this.heldFrets.at(-1) ?? null,
        chordCode: this.heldChords.at(-1) ?? null,
        bend: this.bend,
        vibrato: this.pressed.has("KeyH"),
        hasPlayed: this.hasPlayed,
        stroke: this.stroke,
      };
      for (const listener of this.listeners) listener();
    });
  }

  private isMapped(code: string): boolean {
    return code === "Space" || code === "KeyH" ||
      STRINGS.some((item) => item.code === code) ||
      FRETS.some((item) => item.code === code) ||
      CHORDS.some((item) => item.code === code);
  }

  private isTextTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }

  private removeHeld(held: string[], code: string): void {
    const index = held.indexOf(code);
    if (index !== -1) held.splice(index, 1);
  }
}
