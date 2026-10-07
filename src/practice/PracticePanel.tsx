import { useEffect, useRef, useState } from "react";
import type { Instrument } from "../InstrumentSwitcher";
import { STOP_SOUND_EVENT } from "../studioEvents";
import { getPracticeExercises, performanceLabel, type PracticeStep } from "./exercises";
import { subscribePerformance, type PerformanceHit } from "./events";
import { createReferencePlayer, type ReferencePlayer } from "./demo";
import { PracticeClock } from "./clock";
import { loadProgress, saveProgress, type PracticeProgress } from "./storage";
import { useKeyboardHints } from "./preferences";
import "./practice.css";

type NoteResult = "pending" | "matched" | "early" | "late" | "missed" | "rest";
type Session = {
  mode: "practice" | "demo";
  steps: PracticeStep[];
  offsets: number[];
  beatMs: number;
  firstClickAt: number;
  notesStartAt: number;
  duration: number;
  results: NoteResult[];
  received: Set<string>[];
  timing: ("matched" | "early" | "late")[];
  wrong: number;
  repeat: boolean;
  lastDemo: number;
  baseIndex: number;
  clock: PracticeClock;
  player: ReferencePlayer | null;
  timer: number | null;
};

function summary(session: Session): string {
  const counted = session.results.filter((_, index) => session.steps[index].values.length > 0);
  const matched = counted.filter((result) => result === "matched").length;
  const early = counted.filter((result) => result === "early").length;
  const late = counted.filter((result) => result === "late").length;
  const missed = counted.filter((result) => result === "missed" || result === "pending").length;
  return `Phrase finished: ${matched} on time, ${early} early, ${late} late, ${missed} missed${session.wrong ? `; ${session.wrong} unexpected ${session.wrong === 1 ? "hit" : "hits"}` : ""}.`;
}

function stepAt(offsets: number[], elapsed: number): number {
  for (let index = offsets.length - 1; index >= 0; index -= 1) {
    if (offsets[index] <= elapsed) return index;
  }
  return 0;
}

function rangeHint(instrument: Instrument, steps: PracticeStep[]): string | null {
  if (instrument !== "piano" && instrument !== "synth" && instrument !== "harmonium") return null;
  const notes = steps.flatMap((item) => item.values.map(Number));
  return notes.length ? `Choose C${Math.floor(Math.min(...notes) / 12) - 1} in the keyboard range above. The letter hints match that register.` : null;
}

export function PracticePanel({ instrument }: { instrument: Instrument }) {
  // The parent may reuse this component while switching instruments.
  return <InstrumentPractice key={instrument} instrument={instrument} />;
}

function InstrumentPractice({ instrument }: { instrument: Instrument }) {
  const [exercises] = useState(() => getPracticeExercises(instrument));
  const [progress, setProgress] = useState(() => loadProgress(instrument, exercises));
  const [storageReady, setStorageReady] = useState(true);
  const [hints] = useKeyboardHints();
  const [mode, setMode] = useState<"idle" | "starting" | "practice" | "demo">("idle");
  const [countIn, setCountIn] = useState<number | null>(null);
  const [demoPlayhead, setDemoPlayhead] = useState<number | null>(null);
  const [results, setResults] = useState<NoteResult[]>([]);
  const [feedback, setFeedback] = useState("Listen to the phrase, then play it with a four-beat count-in.");
  const sessionRef = useRef<Session | null>(null);
  const attemptRef = useRef(0);
  const setupRef = useRef<{ clock: PracticeClock; player: ReferencePlayer | null } | null>(null);
  const exercise = exercises.find((item) => item.id === progress.exerciseId)!;
  const phrase = exercise.phrases[progress.phrase];
  const active = mode !== "idle";
  const highlightedStep = demoPlayhead ?? progress.nextStep;

  useEffect(() => { setStorageReady(saveProgress(instrument, progress)); }, [instrument, progress]);

  const stop = (message?: string) => {
    attemptRef.current += 1;
    const session = sessionRef.current;
    if (session?.timer !== null && session?.timer !== undefined) window.clearInterval(session.timer);
    session?.clock.dispose();
    session?.player?.dispose();
    setupRef.current?.clock.dispose();
    setupRef.current?.player?.dispose();
    setupRef.current = null;
    sessionRef.current = null;
    setMode("idle");
    setCountIn(null);
    setDemoPlayhead(null);
    if (message) setFeedback(message);
  };
  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    const pause = () => {
      if (sessionRef.current || setupRef.current) stopRef.current("Practice paused. Continue from the highlighted step when you are ready.");
    };
    const hide = () => { if (document.hidden) pause(); };
    const escape = (event: KeyboardEvent) => { if (event.code === "Escape") pause(); };
    const unsubscribe = subscribePerformance((hit: PerformanceHit) => {
      const session = sessionRef.current;
      if (!session || session.mode !== "practice" || hit.instrument !== instrument) return;
      const elapsed = hit.timestamp - session.notesStartAt;
      if (elapsed < -200) return;
      const tolerance = Math.max(100, Math.min(180, session.beatMs * 0.2));
      const candidates = session.steps.map((item, index) => ({ item, index, delta: elapsed - session.offsets[index] }))
        .filter(({ item, index, delta }) => item.values.includes(hit.value)
          && !session.received[index].has(hit.value)
          && delta >= -tolerance && delta < item.beats * session.beatMs);
      candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
      const candidate = candidates[0];
      if (!candidate) {
        session.wrong += 1;
        const current = stepAt(session.offsets, elapsed);
        const expected = session.steps[current];
        setFeedback(expected.values.length
          ? `You played ${performanceLabel(instrument, hit.value)}. This step asks for ${expected.label}.`
          : `This beat is a rest. Leave it quiet; you played ${performanceLabel(instrument, hit.value)}.`);
        return;
      }
      const { item, index, delta } = candidate;
      session.received[index].add(hit.value);
      const timing = delta < -tolerance * 0.6 ? "early" : delta > tolerance ? "late" : "matched";
      if (timing !== "matched") session.timing[index] = timing;
      if (session.received[index].size === item.values.length) {
        session.results[index] = session.timing[index];
        setResults([...Array.from({ length: session.baseIndex }, () => "pending" as NoteResult), ...session.results]);
        setProgress((saved) => ({ ...saved, nextStep: Math.min(phrase.steps.length - 1, session.baseIndex + index + 1) }));
        setFeedback(session.timing[index] === "matched" ? `${item.label}: on time.`
          : session.timing[index] !== timing ? `${item.label}: one of the hits was ${session.timing[index]}. Aim to land both sounds on the click.`
          : `${item.label}: ${Math.round(Math.abs(delta))} ms ${timing}. Aim for the click.`);
      } else {
        setFeedback(`${performanceLabel(instrument, hit.value)} received. Also play ${item.values.filter((value) => !session.received[index].has(value)).map((value) => performanceLabel(instrument, value)).join(" + ")}.`);
      }
    });
    window.addEventListener("blur", pause);
    window.addEventListener("keydown", escape);
    window.addEventListener(STOP_SOUND_EVENT, pause);
    document.addEventListener("visibilitychange", hide);
    return () => {
      unsubscribe();
      window.removeEventListener("blur", pause);
      window.removeEventListener("keydown", escape);
      window.removeEventListener(STOP_SOUND_EVENT, pause);
      document.removeEventListener("visibilitychange", hide);
      stopRef.current();
    };
  }, [instrument, phrase.steps.length]);

  const start = async (nextMode: "practice" | "demo", fromStart = false) => {
    stop();
    const attempt = attemptRef.current;
    const clock = new PracticeClock();
    const player = nextMode === "demo" ? createReferencePlayer(instrument) : null;
    setupRef.current = { clock, player };
    setMode("starting");
    // Both activations begin synchronously inside this button gesture.
    const [clockReady, playerReady] = await Promise.all([clock.activate(), player?.activate() ?? Promise.resolve(true)]);
    if (attempt !== attemptRef.current) { clock.dispose(); player?.dispose(); return; }
    if (!clockReady || !playerReady) {
      stop("Audio could not start in this browser. Try again after enabling site audio.");
      return;
    }
    setupRef.current = null;
    const baseIndex = nextMode === "demo" || fromStart ? 0 : progress.nextStep;
    const steps = phrase.steps.slice(baseIndex);
    const beatMs = 60000 / progress.bpm;
    let duration = 0;
    const offsets = steps.map((item) => { const offset = duration; duration += item.beats * beatMs; return offset; });
    const firstClickAt = performance.now() + 140;
    const session: Session = {
      mode: nextMode, steps, offsets, beatMs, firstClickAt, notesStartAt: firstClickAt + beatMs * 4,
      duration, results: steps.map((item) => item.values.length ? "pending" : "rest"),
      received: steps.map(() => new Set()), wrong: 0, repeat: progress.repeat && baseIndex === 0,
      timing: steps.map(() => "matched"),
      lastDemo: -1, baseIndex, clock, player, timer: null,
    };
    sessionRef.current = session;
    setMode(nextMode);
    if (nextMode === "demo") setDemoPlayhead(0);
    setResults(phrase.steps.map(() => "pending"));
    setFeedback(nextMode === "demo" ? "Listen to the reference phrase. Your instrument remains available." : "Count four beats, then begin. Feedback checks note onsets, not how long you hold a note.");
    clock.start(progress.bpm, firstClickAt, progress.metronome);
    const tick = () => {
      const elapsed = performance.now() - session.notesStartAt;
      if (elapsed < 0) {
        setCountIn(Math.min(4, Math.max(1, Math.floor((performance.now() - session.firstClickAt) / beatMs) + 1)));
        return;
      }
      setCountIn(null);
      if (elapsed >= duration) {
        if (nextMode === "practice") {
          session.results = session.results.map((result, index) => result === "pending" && steps[index].values.length ? "missed" : result);
          setResults([...Array.from({ length: baseIndex }, () => "pending" as NoteResult), ...session.results]);
          const message = summary(session);
          setProgress((saved) => ({ ...saved, nextStep: 0, completed: Math.min(100000, saved.completed + 1) }));
          setFeedback(message);
          if (!session.repeat) { stop(message); return; }
        } else if (!session.repeat) { stop("Reference finished. Start practice when you are ready."); return; }
        session.notesStartAt += duration;
        session.results = steps.map((item) => item.values.length ? "pending" : "rest");
        session.received = steps.map(() => new Set());
        session.timing = steps.map(() => "matched");
        session.wrong = 0;
        session.lastDemo = -1;
      }
      const localElapsed = performance.now() - session.notesStartAt;
      const current = stepAt(offsets, localElapsed);
      if (nextMode === "demo" && current > session.lastDemo) {
        player?.play(steps[current].values, steps[current].beats * beatMs);
        session.lastDemo = current;
      }
      if (nextMode === "practice") {
        for (let index = 0; index < current; index += 1) {
          if (session.results[index] === "pending") session.results[index] = "missed";
        }
      }
      setResults([...Array.from({ length: baseIndex }, () => "pending" as NoteResult), ...session.results]);
      if (nextMode === "demo") setDemoPlayhead(current);
      else setProgress((saved) => saved.nextStep === baseIndex + current ? saved : ({ ...saved, nextStep: baseIndex + current }));
    };
    session.timer = window.setInterval(tick, 30);
    tick();
  };

  const update = (patch: Partial<PracticeProgress>) => {
    stop();
    setResults([]);
    setProgress((saved) => ({ ...saved, ...patch }));
    setFeedback("Ready. Listen first or start a four-beat count-in.");
  };

  return (
    <section className="practice-panel" aria-labelledby="practice-title">
      <div className="practice-heading">
        <div><span className="practice-kicker">YOUR PRACTICE SESSION</span><h2 id="practice-title">A little progress, every day.</h2></div>
        <span className="practice-save-note">{storageReady ? "Saved on this device" : "Storage unavailable · progress lasts for this session"} · {progress.completed} phrases practised</span>
      </div>
      <div className="practice-settings">
        <label>Exercise<select disabled={active} value={exercise.id} onChange={(event) => update({ exerciseId: event.target.value, phrase: 0, nextStep: 0, completed: 0 })}>
          {exercises.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
        </select></label>
        <label>Phrase<select disabled={active} value={progress.phrase} onChange={(event) => update({ phrase: Number(event.target.value), nextStep: 0 })}>
          {exercise.phrases.map((item, index) => <option value={index} key={item.label}>Phrase {item.label}</option>)}
        </select></label>
        <label className="practice-tempo">Tempo <span>{progress.bpm} BPM</span><input disabled={active} type="range" min="40" max="160" step="1" value={progress.bpm} aria-label="Practice tempo" onChange={(event) => update({ bpm: Number(event.target.value) })} /></label>
      </div>
      <p className="practice-instruction">{exercise.instruction}</p>
      {rangeHint(instrument, phrase.steps) && <p className="practice-register">{rangeHint(instrument, phrase.steps)}</p>}
      <div className="practice-phrase" aria-label={`Phrase ${phrase.label} notes`}>
        {phrase.steps.map((item, index) => <div key={index} className={`practice-note ${results[index] ?? "pending"} ${highlightedStep === index ? "next" : ""}`} aria-current={highlightedStep === index ? "step" : undefined}>
          <span className="practice-note-number">{index + 1}</span><strong>{item.label}</strong>
          <span className="practice-note-beats">{item.beats} {item.beats === 1 ? "beat" : "beats"}</span>
          {hints && <kbd>{item.key}</kbd>}
          {results[index] && results[index] !== "pending" && results[index] !== "rest" && <span className="practice-result">{results[index] === "matched" ? "On time" : results[index]}</span>}
        </div>)}
      </div>
      <div className="practice-toolbar">
        <div className="practice-actions">
          {active ? <button type="button" className="practice-primary" onClick={() => stop("Paused. Continue from the highlighted step, or retry the whole phrase.")}>Pause</button>
            : <button type="button" className="practice-primary" onClick={() => void start("practice")}>{progress.nextStep > 0 ? "Continue practice" : "Start practice"}</button>}
          <button type="button" disabled={active} onClick={() => void start("demo")}>Listen to phrase</button>
          <button type="button" onClick={() => { update({ nextStep: 0 }); void start("practice", true); }}>Retry phrase</button>
        </div>
        <div className="practice-options">
          <label><input type="checkbox" checked={progress.repeat} disabled={active} onChange={(event) => update({ repeat: event.target.checked })} /> Repeat phrase</label>
          <label><input type="checkbox" checked={progress.metronome} disabled={active} onChange={(event) => update({ metronome: event.target.checked })} /> Metronome</label>
        </div>
      </div>
      <div className="practice-feedback" role="status" aria-live="polite">
        {countIn !== null && <span className="practice-count" aria-label={`Count-in beat ${countIn}`}>{countIn}</span>}
        <span>{feedback}</span>
      </div>
      <p className="practice-footnote">Feedback measures key and pad onsets, not recorded sound, sustained-note length, or bellows technique. Device and speaker latency may affect what you hear. {progress.nextStep > 0 && progress.repeat ? "Continue finishes the remaining steps once; retry starts a complete repeating phrase." : ""}</p>
    </section>
  );
}
