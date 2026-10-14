import type { Instrument } from "./InstrumentSwitcher";
import { STRINGS, CHORDS } from "./guitar/model";
import { PIANO_KEYS } from "./piano/model";
import { DRUM_PADS } from "./drums/model";
import { TABLA_PADS } from "./tabla/model";

export function QuickStart({ instrument, onHelp }: { instrument: Instrument; onHelp: () => void }) {
  const percussion = instrument === "drums" || instrument === "tabla";
  const keyboard = instrument === "piano" || instrument === "synth" || instrument === "harmonium";
  const mappings = percussion ? (instrument === "tabla" ? TABLA_PADS : DRUM_PADS).map((pad) => ({ key: pad.key, label: pad.name }))
    : instrument === "guitar" ? STRINGS.map((string) => ({ key: string.key, label: string.subtitle })) : [];
  const notes = (black: boolean) => PIANO_KEYS.filter((key) => key.black === black).map((key) => <kbd key={key.code}>{key.key}</kbd>);
  return <section className="studio-quick-start" aria-label="Quick start and keyboard map">
    <div className="quick-start-heading"><strong>Start here</strong><span>{instrument === "guitar" ? "Hold a chord, then pick or strum." : instrument === "harmonium" ? "Hold a note and supply air below." : percussion ? "Tap a key or click a pad." : "Press a key or click a note."}</span></div>
    <div className="quick-start-map">
      {keyboard ? <><div className="quick-key-row"><span>White notes</span>{notes(false)}</div><div className="quick-key-row"><span>Black notes</span>{notes(true)}</div></>
        : <div className="quick-pad-map">{mappings.map((mapping) => <span key={mapping.key}><kbd>{mapping.key}</kbd>{mapping.label}</span>)}</div>}
      {instrument === "guitar" && <div className="quick-key-row quick-chords"><span>Chords</span>{CHORDS.map((chord) => <span key={chord.code}><kbd>{chord.key}</kbd>{chord.name}</span>)}<span><kbd>Space</kbd> Strum</span></div>}
      {instrument === "piano" && <p className="quick-start-tip"><kbd>Space</kbd> Hold for sustain · Range controls are below the keys.</p>}
      {instrument === "harmonium" && <p className="quick-start-tip"><kbd>Space</kbd> Hold to pump · Choose Steady air to play without pumping.</p>}
      {instrument === "synth" && <p className="quick-start-tip">Play one note at a time · Choose a sound above the keys.</p>}
    </div>
    <button type="button" className="studio-help-button" onClick={onHelp}>How to play</button>
  </section>;
}
