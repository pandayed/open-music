// Physical key positions: white notes on the home row, black notes above them.
export const PIANO_KEYS = [
  { code: "KeyA", key: "A", offset: 0, whiteIndex: 0, black: false },
  { code: "KeyW", key: "W", offset: 1, whiteIndex: 0, black: true },
  { code: "KeyS", key: "S", offset: 2, whiteIndex: 1, black: false },
  { code: "KeyE", key: "E", offset: 3, whiteIndex: 1, black: true },
  { code: "KeyD", key: "D", offset: 4, whiteIndex: 2, black: false },
  { code: "KeyF", key: "F", offset: 5, whiteIndex: 3, black: false },
  { code: "KeyT", key: "T", offset: 6, whiteIndex: 3, black: true },
  { code: "KeyG", key: "G", offset: 7, whiteIndex: 4, black: false },
  { code: "KeyY", key: "Y", offset: 8, whiteIndex: 4, black: true },
  { code: "KeyH", key: "H", offset: 9, whiteIndex: 5, black: false },
  { code: "KeyU", key: "U", offset: 10, whiteIndex: 5, black: true },
  { code: "KeyJ", key: "J", offset: 11, whiteIndex: 6, black: false },
  { code: "KeyK", key: "K", offset: 12, whiteIndex: 7, black: false },
  { code: "KeyO", key: "O", offset: 13, whiteIndex: 7, black: true },
  { code: "KeyL", key: "L", offset: 14, whiteIndex: 8, black: false },
  { code: "KeyP", key: "P", offset: 15, whiteIndex: 8, black: true },
  { code: "Semicolon", key: ";", offset: 16, whiteIndex: 9, black: false },
] as const;

// The first bank starts at C0; only its A0–E1 keys are playable.
export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 7;
export const MIN_PIANO_MIDI = 21;
export const MAX_PIANO_MIDI = 108;

export function isPianoMidi(midi: number): boolean {
  return Number.isInteger(midi) && midi >= MIN_PIANO_MIDI && midi <= MAX_PIANO_MIDI;
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function pianoMidi(offset: number, octave: number): number {
  return (octave + 1) * 12 + offset;
}

export function pianoNoteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
