import type { Instrument } from "../InstrumentSwitcher";
import { PianoAudioEngine } from "../audio/PianoAudioEngine";
import { GuitarAudioEngine } from "../audio/GuitarAudioEngine";
import { DrumAudioEngine } from "../audio/DrumAudioEngine";
import { SynthAudioEngine } from "../audio/SynthAudioEngine";
import { HarmoniumAudioEngine } from "../audio/HarmoniumAudioEngine";
import { TablaAudioEngine } from "../audio/TablaAudioEngine";
import type { DrumId } from "../drums/model";
import type { TablaBol } from "../tabla/model";
import { CHORDS } from "../guitar/model";
import { PLUCK_PRESET } from "../synth/model";

export type ReferencePlayer = {
  activate(): Promise<boolean>;
  play(values: string[], durationMs: number): void;
  dispose(): void;
};

/** Independent voices: demonstrations cannot create practice hits or change a player's controls. */
export function createReferencePlayer(instrument: Instrument): ReferencePlayer {
  const engine = instrument === "piano" ? new PianoAudioEngine()
    : instrument === "guitar" ? new GuitarAudioEngine()
    : instrument === "drums" ? new DrumAudioEngine()
    : instrument === "synth" ? new SynthAudioEngine(() => {})
    : instrument === "harmonium" ? new HarmoniumAudioEngine() : new TablaAudioEngine();
  const releases = new Set<number>();
  let serial = 0;
  const releaseLater = (id: string, duration: number) => {
    const timer = window.setTimeout(() => {
      releases.delete(timer);
      if ("release" in engine) engine.release(id);
    }, Math.max(60, duration * 0.8));
    releases.add(timer);
  };
  return {
    activate: () => engine.activate(),
    play: (values, durationMs) => {
      for (const value of values) {
        const id = `reference-${serial++}`;
        if (engine instanceof PianoAudioEngine) { engine.play(id, Number(value)); releaseLater(id, durationMs); }
        else if (engine instanceof SynthAudioEngine) { engine.play(id, Number(value), PLUCK_PRESET); releaseLater(id, durationMs); }
        else if (engine instanceof HarmoniumAudioEngine) { engine.setPressure(0.75); engine.play(id, Number(value)); releaseLater(id, durationMs); }
        else if (engine instanceof DrumAudioEngine) engine.play(id, value as DrumId);
        else if (engine instanceof TablaAudioEngine) engine.play(id, value as TablaBol);
        else if (engine instanceof GuitarAudioEngine) {
          const chord = CHORDS.find((candidate) => candidate.name === value);
          chord?.frets.forEach((fret, stringIndex) => {
            if (fret >= 0) {
              const voiceId = `${id}-${stringIndex}`;
              engine.play(voiceId, stringIndex, fret, stringIndex * 0.018);
              releaseLater(voiceId, durationMs);
            }
          });
        }
      }
    },
    dispose: () => {
      for (const timer of releases) window.clearTimeout(timer);
      releases.clear();
      engine.stopAll();
      engine.dispose();
    },
  };
}
