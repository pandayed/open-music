import { TablaAudioEngine } from "../audio/TablaAudioEngine";
import { TABLA_PADS } from "./model";
import type { TablaBol } from "./model";

export type TablaSnapshot = {
  activePads: TablaBol[];
  soundingPads: TablaBol[];
  lastHit: TablaBol | null;
  hasPlayed: boolean;
  audioUnavailable: boolean;
};

/** Owns one-shot hits, their visual feedback, and physical keyboard guards. */
export class TablaController {
  private readonly engine = new TablaAudioEngine((id) => this.onVoiceEnd(id));
  private readonly listeners = new Set<() => void>();
  private readonly pressed = new Set<string>();
  private readonly voices = new Map<string, TablaBol>();
  private readonly flashes = new Map<TablaBol, ReturnType<typeof setTimeout>>();
  private serial = 0;
  private lastHit: TablaBol | null = null;
  private hasPlayed = false;
  private audioUnavailable = false;
  private snapshot: TablaSnapshot = {
    activePads: [], soundingPads: [], lastHit: null,
    hasPlayed: false, audioUnavailable: false,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TablaSnapshot => this.snapshot;

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

  hit(bol: TablaBol): void {
    if (!TABLA_PADS.some((pad) => pad.id === bol)) return;
    const id = `tabla-${++this.serial}`;
    if (!this.engine.play(id, bol)) {
      this.audioUnavailable = true;
      this.publish();
      return;
    }

    this.voices.set(id, bol);
    this.audioUnavailable = false;
    this.hasPlayed = true;
    this.lastHit = bol;
    const previousFlash = this.flashes.get(bol);
    if (previousFlash !== undefined) clearTimeout(previousFlash);
    this.flashes.set(bol, setTimeout(() => {
      this.flashes.delete(bol);
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
    const pad = TABLA_PADS.find((item) => item.code === event.code);
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
