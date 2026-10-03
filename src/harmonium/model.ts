export {
  PIANO_KEYS as HARMONIUM_KEYS,
  MIN_OCTAVE,
  MAX_OCTAVE,
  pianoMidi as harmoniumMidi,
  pianoNoteName as harmoniumNoteName,
} from "../piano/model";

export type BellowsMode = "manual" | "hinge" | "steady";

export const START_OCTAVE = 3;
export const STEADY_PRESSURE = 0.65;
export const MANUAL_PUMP_RATE = 1.1;
export const AIR_DECAY_RATE = 0.3;
export const AIR_PER_DEGREE = 0.018;
