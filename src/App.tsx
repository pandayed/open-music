import { useState } from "react";
import type { KeyboardEvent } from "react";
import Guitar from "./Guitar";
import Piano from "./piano/Piano";
import Drums from "./drums/Drums";
import Synth from "./synth/Synth";
import Harmonium from "./harmonium/Harmonium";
import Tabla from "./tabla/Tabla";
import { InstrumentSwitcher } from "./InstrumentSwitcher";
import type { Instrument } from "./InstrumentSwitcher";
import { PracticePanel } from "./practice/PracticePanel";
import { useKeyboardHints } from "./practice/preferences";
import { SessionAudio } from "./SessionAudio";
import { InstrumentGuide } from "./InstrumentGuide";
import { SongLessons } from "./SongLessons";
import { QuickStart } from "./QuickStart";
import { readPreference, writePreference } from "./preferences";
import "./studio.css";

type Activity = "play" | "practice" | "learn";
const instruments: Instrument[] = ["guitar", "piano", "drums", "synth", "harmonium", "tabla"];
const activities: { id: Activity; label: string; detail: string }[] = [
  { id: "play", label: "Play", detail: "Choose your keys and start playing." },
  { id: "practice", label: "Practice", detail: "Listen to a phrase, then play it back." },
  { id: "learn", label: "How to play", detail: "Key mappings, instructions and songs." },
];

function InstrumentView({ instrument }: { instrument: Instrument }) {
  // Mount only one controller; switching disposes notes, listeners and hardware access.
  if (instrument === "guitar") return <Guitar />;
  if (instrument === "piano") return <Piano />;
  if (instrument === "synth") return <Synth />;
  if (instrument === "harmonium") return <Harmonium />;
  if (instrument === "tabla") return <Tabla />;
  return <Drums />;
}

function protectControlKeys(event: KeyboardEvent<HTMLDivElement>) {
  // Let focused controls use Space without pumping, sustaining or strumming.
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const controlSpace = event.code === "Space" && target.closest("button, a, summary, audio");
  const playbackKey = event.code !== "Escape" && target.closest("audio");
  if (controlSpace || playbackKey) event.stopPropagation();
}

export default function App() {
  const [instrument, setInstrument] = useState<Instrument>(() => {
    const saved = readPreference("instrument");
    return instruments.includes(saved as Instrument) ? saved as Instrument : "guitar";
  });
  const [activity, setActivity] = useState<Activity>(() => {
    const saved = readPreference("activity");
    return activities.some((item) => item.id === saved) ? saved as Activity : "play";
  });
  const [showHints, setShowHints] = useKeyboardHints();
  const [surfaceSize, setSurfaceSize] = useState<"compact" | "roomy">(() => readPreference("surface-size") === "roomy" ? "roomy" : "compact");

  function selectInstrument(next: Instrument) {
    if (next === instrument) return;
    setInstrument(next);
    writePreference("instrument", next);
  }

  function selectActivity(next: Activity) {
    setActivity(next);
    writePreference("activity", next);
    requestAnimationFrame(() => {
      const destination = document.getElementById(next === "play" ? "studio-workspace" : "studio-companion");
      destination?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1279px)").matches) destination?.scrollIntoView({ block: "start" });
    });
  }

  return <div className="studio" data-activity={activity} data-surface-size={surfaceSize} data-keyboard-hints={showHints ? "show" : "hide"} onKeyDown={protectControlKeys}>
    <a className="studio-skip" href="#studio-workspace">Skip to instrument</a>
    <header className="studio-header">
      <div className="studio-brand"><span className="brand">NERDBOARD<span className="brand-period">.</span></span><span className="studio-tagline">Your music practice studio</span></div>
      <span className="studio-desktop-note">Play with your computer keyboard</span>
    </header>
    <div className="studio-instrument-picker"><span className="studio-control-label">Instrument</span><InstrumentSwitcher selected={instrument} onSelect={selectInstrument} /></div>
    <div className="studio-bar">
      <nav className="studio-activities" aria-label="Studio activity"
        onKeyDown={(event) => { if (event.code === "Space") event.stopPropagation(); }}>
        {activities.map((item) => <button key={item.id} type="button" aria-pressed={activity === item.id} onClick={() => selectActivity(item.id)}>{item.label}</button>)}
      </nav>
      <div className="studio-view-controls">
        <label className="studio-hints"><input type="checkbox" checked={showHints} onChange={(event) => setShowHints(event.target.checked)} /> Show keys</label>
        <div className="studio-size" role="group" aria-label="Playing surface size"><span>Instrument size</span>{(["compact", "roomy"] as const).map((size) => <button type="button" key={size} aria-pressed={surfaceSize === size} onClick={() => { setSurfaceSize(size); writePreference("surface-size", size); }}>{size === "compact" ? "Compact" : "Roomy"}</button>)}</div>
      </div>
    </div>
    <div className="studio-intro">
      <h1>{instrument === "synth" ? "Synthesizer" : instrument.charAt(0).toUpperCase() + instrument.slice(1)}</h1>
      <p>{activities.find((item) => item.id === activity)?.detail}</p>
    </div>
    <QuickStart instrument={instrument} onHelp={() => selectActivity("learn")} />
    <div id="studio-workspace" className="studio-workspace" tabIndex={-1}>
      <div className="studio-instrument"><SessionAudio key={instrument} /><InstrumentView instrument={instrument} /></div>
      {activity !== "play" && <aside id="studio-companion" className="studio-companion" tabIndex={-1} aria-label={activity === "practice" ? "Practice session" : "How to play"}>
        <div className="studio-companion-heading"><span className="studio-eyebrow">{activity === "practice" ? "GUIDED PRACTICE" : "INSTRUCTIONS & KEY MAP"}</span><button type="button" className="piano-action" onClick={() => selectActivity("play")}>Back to play</button></div>
        {activity === "practice" ? <PracticePanel key={instrument} instrument={instrument} />
          : <><InstrumentGuide instrument={instrument} /><details className="studio-song-guide"><summary>Songs & example rhythms</summary><SongLessons instrument={instrument} /></details></>}
      </aside>}
    </div>
    <footer className="studio-footer"><span>Play. Practise. Make it yours.</span><span>Preferences and practice progress stay in this browser.</span></footer>
    <div className="studio-keyboard-required small-screen-message">
      <span className="brand">NERDBOARD<span className="brand-period">.</span></span>
      <h1>Made for a physical keyboard.</h1>
      <p>Open Nerdboard on a laptop or desktop with a physical keyboard. Use a browser window at least 980 pixels wide to make room for the instrument and its controls.</p>
    </div>
  </div>;
}
