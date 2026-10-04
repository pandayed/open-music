export type Instrument = "guitar" | "piano" | "drums" | "synth" | "harmonium" | "tabla";

export function InstrumentSwitcher({ selected, onSelect }: {
  selected: Instrument;
  onSelect: (instrument: Instrument) => void;
}) {
  return (
    <nav
      className="instrument-switcher"
      aria-label="Choose an instrument"
      onKeyDown={(event) => { if (event.code === "Space") event.stopPropagation(); }}
      onKeyUp={(event) => { if (event.code === "Space") event.stopPropagation(); }}
    >
      <button type="button" aria-pressed={selected === "guitar"} onClick={() => onSelect("guitar")}>
        <span>01</span> Guitar
      </button>
      <button type="button" aria-pressed={selected === "piano"} onClick={() => onSelect("piano")}>
        <span>02</span> Piano
      </button>
      <button type="button" aria-pressed={selected === "drums"} onClick={() => onSelect("drums")}>
        <span>03</span> Drums
      </button>
      <button type="button" aria-pressed={selected === "synth"} onClick={() => onSelect("synth")}>
        <span>04</span> Synthesizer
      </button>
      <button type="button" aria-pressed={selected === "harmonium"} onClick={() => onSelect("harmonium")}>
        <span>05</span> Harmonium
      </button>
      <button type="button" aria-pressed={selected === "tabla"} onClick={() => onSelect("tabla")}>
        <span>06</span> Tabla
      </button>
    </nav>
  );
}
