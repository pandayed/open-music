export const DRUM_PADS = [
  { id: "kick", code: "KeyA", key: "A", name: "Kick", description: "Low-end pulse", family: "drum" },
  { id: "snare", code: "KeyS", key: "S", name: "Snare", description: "Sharp backbeat", family: "drum" },
  { id: "closed-hat", code: "KeyD", key: "D", name: "Closed hi-hat", description: "Tight timekeeper", family: "cymbal" },
  { id: "open-hat", code: "KeyF", key: "F", name: "Open hi-hat", description: "Let it sizzle", family: "cymbal" },
  { id: "high-tom", code: "KeyJ", key: "J", name: "High tom", description: "Start a fill", family: "drum" },
  { id: "low-tom", code: "KeyK", key: "K", name: "Low tom", description: "Round and deep", family: "drum" },
  { id: "crash", code: "KeyL", key: "L", name: "Crash", description: "Mark the moment", family: "cymbal" },
  { id: "ride", code: "Semicolon", key: ";", name: "Ride", description: "Keep it flowing", family: "cymbal" },
] as const;

export type DrumId = typeof DRUM_PADS[number]["id"];
