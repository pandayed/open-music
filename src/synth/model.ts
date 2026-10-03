// The synthesizer and piano use the same physical chromatic keyboard layout.
export { PIANO_KEYS as SYNTH_KEYS, pianoMidi as synthMidi, pianoNoteName as synthNoteName } from "../piano/model";

export const MIN_SYNTH_OCTAVE = 2;
export const MAX_SYNTH_OCTAVE = 6;

export type SynthSettings = { brightness: number; decay: number; echo: number };
export const PLUCK_PRESET: SynthSettings = { brightness: 45, decay: 500, echo: 10 };
