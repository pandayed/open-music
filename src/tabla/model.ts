export const TABLA_PADS = [
  { id: "na", code: "KeyA", key: "A", name: "Na", description: "Bright rim stroke", family: "dayan" },
  { id: "tin", code: "KeyS", key: "S", name: "Tin", description: "Clear ringing treble", family: "dayan" },
  { id: "tun", code: "KeyD", key: "D", name: "Tun", description: "Open treble tone", family: "dayan" },
  { id: "te", code: "KeyF", key: "F", name: "Te", description: "Dry treble tap", family: "dayan" },
  { id: "ge", code: "KeyJ", key: "J", name: "Ge", description: "Resonant bass", family: "bayan" },
  { id: "ke", code: "KeyK", key: "K", name: "Ke", description: "Muted bass slap", family: "bayan" },
  { id: "dha", code: "KeyL", key: "L", name: "Dha", description: "Na + Ge together", family: "both" },
  { id: "dhin", code: "Semicolon", key: ";", name: "Dhin", description: "Tin + Ge together", family: "both" },
] as const;

export type TablaBol = typeof TABLA_PADS[number]["id"];

// Short practice exercises, rather than a complete traditional taal lesson.
export const TABLA_PRACTICE: { title: string; instruction: string; strokes: TablaBol[] }[] = [
  { title: "Alternate the drums", instruction: "Tap one stroke per beat. Say each stroke name as you play, then repeat.", strokes: ["na", "ge", "tin", "ge", "tun", "ke", "te", "ke"] },
  { title: "Add combined strokes", instruction: "Keep an even pulse. Dha and Dhin each play both drums with one key.", strokes: ["dha", "dhin", "na", "tin", "dha", "ge", "te", "ke"] },
];
