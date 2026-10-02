export type Instrument = "guitar" | "piano" | "drums";

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
    </nav>
  );
}
