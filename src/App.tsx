import { useState } from "react";
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
import { readPreference, writePreference } from "./preferences";
import "./studio.css";

type Activity = "play" | "practice" | "learn";
const instruments: Instrument[] = ["guitar", "piano", "drums", "synth", "harmonium", "tabla"];
const activities: { id: Activity; label: string; detail: string }[] = [
  { id: "play", label: "Play", detail: "Make room for music." },
  { id: "practice", label: "Practice", detail: "A phrase at a time. At your own pace." },
  { id: "learn", label: "Learn", detail: "Get to know your instrument." },
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

  function selectInstrument(next: Instrument) {
    if (next === instrument) return;
    setInstrument(next);
    writePreference("instrument", next);
  }

  function selectActivity(next: Activity) {
    setActivity(next);
    writePreference("activity", next);
  }

  return <div className="studio" data-activity={activity} data-keyboard-hints={showHints ? "show" : "hide"}>
    <a className="studio-skip" href="#studio-workspace">Skip to instrument</a>
    <header className="studio-header">
      <div className="studio-brand"><span className="brand">NERDBOARD<span className="brand-period">.</span></span><span className="studio-tagline">Your music practice studio</span></div>
      <InstrumentSwitcher selected={instrument} onSelect={selectInstrument} />
    </header>
    <div className="studio-bar">
      <nav className="studio-activities" aria-label="Studio activity"
        onKeyDown={(event) => { if (event.code === "Space") event.stopPropagation(); }}
        onKeyUp={(event) => { if (event.code === "Space") event.stopPropagation(); }}>
        {activities.map((item) => <button key={item.id} type="button" aria-pressed={activity === item.id} onClick={() => selectActivity(item.id)}>{item.label}</button>)}
      </nav>
      <label className="studio-hints"><input type="checkbox" checked={showHints} onChange={(event) => setShowHints(event.target.checked)} /> Keyboard hints</label>
    </div>
    <div className="studio-intro">
      <div><span className="studio-eyebrow">{activity === "play" ? "FREE PLAY" : activity === "practice" ? "GUIDED PRACTICE" : "INSTRUMENT GUIDE"}</span><h1>{instrument === "synth" ? "Synthesizer" : instrument.charAt(0).toUpperCase() + instrument.slice(1)}</h1></div>
      <p>{activities.find((item) => item.id === activity)?.detail}</p>
    </div>
    <SessionAudio key={instrument} />
    <div id="studio-workspace" className="studio-workspace" tabIndex={-1}>
      <div className="studio-instrument"><InstrumentView instrument={instrument} /></div>
      <aside className="studio-companion" aria-label={activity === "practice" ? "Practice session" : "Instrument learning"}>
        {activity === "practice" ? <PracticePanel key={instrument} instrument={instrument} />
          : <><InstrumentGuide instrument={instrument} compact={activity === "play"} />{activity === "learn" && <SongLessons instrument={instrument} />}</>}
      </aside>
    </div>
    <footer className="studio-footer"><span>Play. Practise. Make it yours.</span><span>Preferences and practice progress stay in this browser.</span></footer>
    <div className="studio-keyboard-required small-screen-message">
      <span className="brand">NERDBOARD<span className="brand-period">.</span></span>
      <h1>Made for a physical keyboard.</h1>
      <p>Open Nerdboard on a laptop or desktop with a physical keyboard. Use a browser window at least 980 pixels wide to make room for the instrument and its controls.</p>
    </div>
  </div>;
}
