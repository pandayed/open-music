export const STRINGS = [
  { key: "Q", code: "KeyQ", name: "E", subtitle: "LOW E", midi: 40 },
  { key: "W", code: "KeyW", name: "A", subtitle: "A", midi: 45 },
  { key: "E", code: "KeyE", name: "D", subtitle: "D", midi: 50 },
  { key: "R", code: "KeyR", name: "G", subtitle: "G", midi: 55 },
  { key: "T", code: "KeyT", name: "B", subtitle: "B", midi: 59 },
  { key: "Y", code: "KeyY", name: "e", subtitle: "HIGH E", midi: 64 },
] as const;

export const FRETS = [
  { key: "A", code: "KeyA", fret: 0, label: "OPEN" },
  { key: "S", code: "KeyS", fret: 1, label: "FRET 01" },
  { key: "D", code: "KeyD", fret: 2, label: "FRET 02" },
  { key: "F", code: "KeyF", fret: 3, label: "FRET 03" },
  { key: "G", code: "KeyG", fret: 4, label: "FRET 04" },
] as const;

export const CHORDS = [
  { key: "Z", code: "KeyZ", name: "C", frets: [-1, 3, 2, 0, 1, 0] },
  { key: "X", code: "KeyX", name: "G", frets: [3, 2, 0, 0, 0, 3] },
  { key: "C", code: "KeyC", name: "D", frets: [-1, -1, 0, 2, 3, 2] },
  { key: "V", code: "KeyV", name: "A", frets: [-1, 0, 2, 2, 2, 0] },
  { key: "B", code: "KeyB", name: "E", frets: [0, 2, 2, 1, 0, 0] },
  { key: "N", code: "KeyN", name: "Am", frets: [-1, 0, 2, 2, 1, 0] },
  { key: "M", code: "KeyM", name: "Em", frets: [0, 2, 2, 0, 0, 0] },
] as const;

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function noteName(stringIndex: number, fret: number): string {
  return NOTE_NAMES[(STRINGS[stringIndex].midi + fret) % 12];
}
