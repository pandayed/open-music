/** Preferences are optional: blocked storage must never prevent playing. */
export function readPreference(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(`nerdboard:${key}`) ?? "null"); }
  catch { return null; }
}

export function writePreference(key: string, value: unknown): void {
  try { localStorage.setItem(`nerdboard:${key}`, JSON.stringify(value)); }
  catch { /* The instrument remains usable when storage is unavailable. */ }
}

export const RANGE_SHORTCUTS = [
  { code: "ShiftLeft", label: "Left Shift" },
  { code: "ShiftRight", label: "Right Shift" },
  { code: "PageDown", label: "Page Down" },
  { code: "PageUp", label: "Page Up" },
  { code: "BracketLeft", label: "[" },
  { code: "BracketRight", label: "]" },
] as const;
export type RangeShortcut = typeof RANGE_SHORTCUTS[number]["code"];
export type RangeShortcuts = { lower: RangeShortcut; higher: RangeShortcut };
export const DEFAULT_RANGE_SHORTCUTS: RangeShortcuts = { lower: "ShiftLeft", higher: "ShiftRight" };

export function isRangeShortcut(value: unknown): value is RangeShortcut {
  return RANGE_SHORTCUTS.some((shortcut) => shortcut.code === value);
}

export function readRangeShortcuts(instrument: string): RangeShortcuts {
  const saved = readPreference(`${instrument}:shortcuts`);
  if (saved && typeof saved === "object" && "lower" in saved && "higher" in saved &&
      isRangeShortcut(saved.lower) && isRangeShortcut(saved.higher) && saved.lower !== saved.higher) {
    return { lower: saved.lower, higher: saved.higher };
  }
  return { ...DEFAULT_RANGE_SHORTCUTS };
}

export function readOctave(instrument: string, fallback: number, min: number, max: number): number {
  const saved = readPreference(`${instrument}:octave`);
  return typeof saved === "number" && Number.isInteger(saved) && saved >= min && saved <= max ? saved : fallback;
}
