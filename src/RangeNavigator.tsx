import { RANGE_SHORTCUTS, isRangeShortcut } from "./preferences";
import type { RangeShortcuts } from "./preferences";
import "./range.css";

export function RangeNavigator({ octave, min, max, range, fullRange, shortcuts, bankLabel, onOctave, onShortcut }: {
  octave: number;
  min: number;
  max: number;
  range: string;
  fullRange: string;
  shortcuts: RangeShortcuts;
  bankLabel?: (octave: number) => string;
  onOctave: (octave: number) => void;
  onShortcut: (direction: keyof RangeShortcuts, code: RangeShortcuts["lower"]) => void;
}) {
  const label = (code: string) => RANGE_SHORTCUTS.find((shortcut) => shortcut.code === code)?.label ?? code;
  return <div className="range-navigator">
    <div className="range-heading">
      <div><span className="piano-toolbar-label">KEYBOARD RANGE</span><strong aria-live="polite">{range}</strong></div>
      <span>{fullRange} available · held notes keep their pitch</span>
    </div>
    <div className="range-row">
      <button type="button" className="piano-action range-step" disabled={octave === min} onClick={() => onOctave(octave - 1)} aria-label={`Lower octave, ${label(shortcuts.lower)}`}>
        <span aria-hidden="true">−</span> {label(shortcuts.lower)}
      </button>
      <div className="range-banks" role="group" aria-label="Select keyboard range">
        {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((bank) =>
          <button type="button" key={bank} className={`range-bank${bank === octave ? " is-selected" : ""}`} aria-pressed={bank === octave}
            aria-label={`Keyboard starting at ${bankLabel?.(bank) ?? `C${bank}`}`} onClick={() => onOctave(bank)}>
            {bankLabel?.(bank) ?? `C${bank}`}
          </button>)}
      </div>
      <button type="button" className="piano-action range-step" disabled={octave === max} onClick={() => onOctave(octave + 1)} aria-label={`Higher octave, ${label(shortcuts.higher)}`}>
        {label(shortcuts.higher)} <span aria-hidden="true">+</span>
      </button>
    </div>
    <details className="range-preferences">
      <summary>Change range shortcuts</summary>
      <div className="range-shortcut-settings">
        {(["lower", "higher"] as const).map((direction) => <label key={direction}>{direction === "lower" ? "Lower octave" : "Higher octave"}
          <select value={shortcuts[direction]} onChange={(event) => {
            if (isRangeShortcut(event.target.value)) onShortcut(direction, event.target.value);
          }}>
            {RANGE_SHORTCUTS.map((shortcut) => <option key={shortcut.code} value={shortcut.code}
              disabled={shortcut.code === shortcuts[direction === "lower" ? "higher" : "lower"]}>{shortcut.label}</option>)}
          </select>
        </label>)}
        <p>Tap once to move an octave. Arrow keys also work. Shortcuts are saved on this device.</p>
      </div>
    </details>
  </div>;
}
