// The synthesizer and piano use the same physical chromatic keyboard layout.
export { PIANO_KEYS as SYNTH_KEYS, pianoMidi as synthMidi, pianoNoteName as synthNoteName } from "../piano/model";

export const MIN_SYNTH_OCTAVE = 2;
export const MAX_SYNTH_OCTAVE = 6;

export type SynthSettings = { brightness: number; decay: number; echo: number };
export type SynthPresetId = "alors-pluck" | "tokyo-bell";
export const PLUCK_PRESET: SynthSettings = { brightness: 45, decay: 500, echo: 10 };
export const TOKYO_BELL_PRESET: SynthSettings = { brightness: 70, decay: 350, echo: 0 };
export const SYNTH_PRESETS: { id: SynthPresetId; name: string; description: string; octave: number; settings: SynthSettings }[] = [
  { id: "alors-pluck", name: "Alors-style pluck", description: "A punchy, hollow pluck inspired by the opening of Alors on danse. Play one note at a time.", octave: 3, settings: PLUCK_PRESET },
  { id: "tokyo-bell", name: "Tokyo Drift-style bell", description: "A bright, metallic bell inspired by the Tokyo Drift opening. Short taps bring out its gamelan-like ring.", octave: 4, settings: TOKYO_BELL_PRESET },
];
