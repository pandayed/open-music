import { STOP_SOUND_EVENT } from "../studioEvents";
import { DrumAudioEngine } from "../audio/DrumAudioEngine";
import { DRUM_PADS } from "./model";
import type { DrumId } from "./model";
import { publishPerformance } from "../practice/events";

export type DrumSnapshot = {
  activePads: DrumId[];
  soundingPads: DrumId[];
  lastHit: DrumId | null;
  hasPlayed: boolean;
  audioUnavailable: boolean;
};

/** Owns one-shot hits, their visual feedback, and physical keyboard guards. */
export class DrumController {
  private readonly engine = new DrumAudioEngine((id) => this.onVoiceEnd(id));
  private readonly listeners = new Set<() => void>();
  private readonly pressed = new Set<string>();
  private readonly voices = new Map<string, DrumId>();
  private readonly flashes = new Map<DrumId, ReturnType<typeof setTimeout>>();
  private serial = 0;
  private lastHit: DrumId | null = null;
  private hasPlayed = false;
  private audioUnavailable = false;
  private snapshot: DrumSnapshot = {
    activePads: [], soundingPads: [], lastHit: null,
    hasPlayed: false, audioUnavailable: false,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DrumSnapshot => this.snapshot;

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

  hit(drum: DrumId): void {
    if (!DRUM_PADS.some((pad) => pad.id === drum)) return;
    const id = `drum-${++this.serial}`;
    if (!this.engine.play(id, drum)) {
      this.audioUnavailable = true;
      this.publish();
      return;
    }

    this.voices.set(id, drum);
    publishPerformance("drums", drum);
    this.audioUnavailable = false;
    this.hasPlayed = true;
    this.lastHit = drum;
    const previousFlash = this.flashes.get(drum);
    if (previousFlash !== undefined) clearTimeout(previousFlash);
    this.flashes.set(drum, setTimeout(() => {
      this.flashes.delete(drum);
      this.publish();
    }, 120));
    this.publish();
  }

  stopAll = (): void => {
    for (const timer of this.flashes.values()) clearTimeout(timer);
    this.flashes.clear();
    this.pressed.clear();
    this.voices.clear();
    this.lastHit = null;
    this.engine.stopAll();
    this.publish();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || this.isTextTarget(event.target)) return;
    if (event.code === "Escape") {
      event.preventDefault();
      this.stopAll();
      return;
    }
    const pad = DRUM_PADS.find((item) => item.code === event.code);
    if (!pad) return;
    event.preventDefault();
    if (event.repeat || this.pressed.has(event.code)) return;
    this.pressed.add(event.code);
    this.hit(pad.id);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    // Releasing a key rearms its hit; the one-shot sound keeps ringing.
    if (!this.pressed.delete(event.code)) return;
    if (!event.defaultPrevented) event.preventDefault();
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) this.stopAll();
  };

  private onVoiceEnd(id: string): void {
    if (this.voices.delete(id)) this.publish();
  }

  private publish(): void {
    this.snapshot = {
      activePads: [...this.flashes.keys()],
      soundingPads: [...new Set(this.voices.values())],
      lastHit: this.lastHit,
      hasPlayed: this.hasPlayed,
      audioUnavailable: this.audioUnavailable,
    };
    for (const listener of this.listeners) listener();
  }

  private isTextTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }
}
