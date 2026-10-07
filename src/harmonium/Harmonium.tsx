import { RangeNavigator } from "../RangeNavigator";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { HarmoniumController } from "./HarmoniumController";
import { HingeSetupDialog, hingeStatus } from "./HingeSetupDialog";
import "./harmonium.css";
import { HARMONIUM_KEYS, MAX_OCTAVE, MIN_OCTAVE, harmoniumMidi, harmoniumNoteName } from "./model";
import type { BellowsMode } from "./model";

function HarmoniumMark() {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <rect x="4" y="7" width="28" height="24" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 18h26M11 19v11M18 19v11M25 19v11M8 11h20M8 14h20" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 19h6v6H8zM22 19h6v6h-6z" fill="currentColor" />
  </svg>;
}

const MODES: { value: BellowsMode; label: string }[] = [
  { value: "manual", label: "Manual pump" },
  { value: "steady", label: "Steady air" },
  { value: "hinge", label: "Hinge bellows" },
];

export default function Harmonium() {
  const controller = useMemo(() => new HarmoniumController(), []);
  const [setupOpen, setSetupOpen] = useState(false);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => { controller.attach(); return () => controller.dispose(); }, [controller]);
  const heldMidi = new Set(state.notes.map((note) => note.midi));
  const names = [...heldMidi].sort((a, b) => a - b).map(harmoniumNoteName);
  const range = `${harmoniumNoteName(harmoniumMidi(0, state.octave))} – ${harmoniumNoteName(harmoniumMidi(16, state.octave))}`;
  const pressure = Math.round(state.pressure * 100);
  const status = hingeStatus(state);

  function pressKey(event: PointerEvent<HTMLButtonElement>, offset: number) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea, select")) document.activeElement.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.press(`pointer-${event.pointerId}`, offset);
  }
  function releaseKey(event: PointerEvent<HTMLButtonElement>) { controller.release(`pointer-${event.pointerId}`); }
  function startPump(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.startPump(`pump-${event.pointerId}`);
  }
  function endPump(event: PointerEvent<HTMLButtonElement>) { controller.endPump(`pump-${event.pointerId}`); }

  return <div className="app-shell harmonium-experience">
    <div className="small-screen-message">
      <HarmoniumMark /><h1>Made for a keyboard.</h1>
      <p>This instrument is designed to be played on a larger screen with a physical keyboard.</p>
    </div>
    <div className="desktop-experience">
      <div className="instrument-audio-state">
        <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
          <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
        </div>
      </div>
      <main>
        <section className="instrument-section" aria-label="Virtual harmonium">
          <div className="section-heading">
            <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
            <span className="tuning-label">HARMONIUM <span>{range} · A4 = 440 Hz</span></span>
          </div>
          <div className="piano-instrument harmonium-instrument">
            <div className="harmonium-panel">
              <div className="harmonium-bellows">
                <span className="synth-kicker">HARMONIUM / BELLOWS</span>
                <div className="harmonium-modes" role="group" aria-label="Bellows mode">
                  {MODES.map((mode) => <button key={mode.value} type="button" className="piano-action"
                    aria-pressed={state.mode === mode.value} disabled={mode.value === "hinge" && state.hinge.kind !== "connected"}
                    aria-describedby={mode.value === "hinge" && state.hinge.kind !== "connected" ? "harmonium-hinge-help" : undefined}
                    onClick={() => controller.setMode(mode.value)}>{mode.label}</button>)}
                </div>
                <p id="harmonium-hinge-help" className="harmonium-hinge-help">
                  {state.hinge.kind === "connected" ? status : "Hinge control needs a compatible lid sensor."} <button type="button" className="hinge-inline-link" onClick={() => setSetupOpen(true)}>{state.hinge.kind === "connected" ? "Sensor settings" : "Check compatibility and set up"}</button>
                </p>
                <p className="harmonium-mode-hint">{state.mode === "manual" ? "Hold Space or the pump button to fill the bellows. Air fades when you stop."
                  : state.mode === "steady" ? "A steady air supply lets you play freely with both hands."
                    : "Gentle lid strokes fill the bellows. Sensitivity adjusts the air supplied by each movement."}</p>
                <button type="button" className={`piano-action harmonium-pump${state.pumping ? " is-pumping" : ""}`}
                  disabled={state.mode !== "manual"} aria-pressed={state.pumping}
                  onPointerDown={startPump} onPointerUp={endPump} onPointerCancel={endPump} onLostPointerCapture={endPump}
                  onKeyDown={(event) => {
                    if (event.code === "Space" || event.code === "Enter") {
                      event.preventDefault(); event.stopPropagation();
                      controller.startPump("focused-pump");
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.code === "Space" || event.code === "Enter") {
                      event.preventDefault(); event.stopPropagation(); controller.endPump("focused-pump");
                    }
                  }}
                  onBlur={() => controller.endPump("focused-pump")}
                  onClick={(event) => { if (event.detail === 0) controller.pumpOnce(); }}>
                  {state.pumping ? "PUMPING AIR" : "HOLD TO PUMP"}<span>SPACE</span>
                </button>
              </div>
              <div className="harmonium-pressure">
                <div className="harmonium-pressure-heading"><span>AIR PRESSURE</span><output>{pressure}%</output></div>
                <div className="harmonium-air-meter" role="meter" aria-label="Air pressure" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pressure}>
                  <span style={{ width: `${pressure}%` }} />
                </div>
                <div className="harmonium-folds" style={{ "--air": state.pressure } as CSSProperties} aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
                </div>
                <div className="harmonium-bellows-settings">
                  <label>Sensitivity <input aria-label="Bellows sensitivity" type="range" min="0.5" max="6" step="0.1" value={state.sensitivity} onChange={(event) => controller.setSensitivity(Number(event.target.value))} /><output>{state.sensitivity.toFixed(1)}×</output></label>
                  <label>Air retention <select value={state.retention} onChange={(event) => controller.setRetention(event.target.value === "natural" ? "natural" : "smooth")}><option value="smooth">Smooth · longer air</option><option value="natural">Natural · quicker fade</option></select></label>
                </div>
                <p>{pressure === 0 ? "No air · pump or choose Steady air to hear held notes." : "Hold a note or a chord. Air controls its volume."}</p>
              </div>
            </div>
            <div className="piano-keyboard" role="group" aria-label={`Harmonium keyboard, ${range}`}>
              {HARMONIUM_KEYS.map((key) => {
                const midi = harmoniumMidi(key.offset, state.octave);
                const name = harmoniumNoteName(midi);
                const held = heldMidi.has(midi);
                return <button key={key.code} type="button"
                  className={`piano-key ${key.black ? "piano-black-key" : "piano-white-key"}${held ? " is-held" : ""}`}
                  style={{ "--key-index": key.whiteIndex } as CSSProperties}
                  aria-label={`${name}, keyboard ${key.key}`} aria-pressed={held}
                  onPointerDown={(event) => pressKey(event, key.offset)} onPointerUp={releaseKey}
                  onPointerCancel={releaseKey} onLostPointerCapture={releaseKey}
                  onClick={(event) => { if (event.detail === 0) controller.tap(key.offset); }}>
                  <span className="piano-note-label">{name}</span><span className="piano-key-label">{key.key}</span>
                </button>;
              })}
            </div>
            <div className="piano-bottomline">
              <span className="piano-note-readout">{names.length ? names.join(" · ") : `C${state.octave} IS A / HOLD KEYS TO PLAY`}</span>
              <span className="play-indicator">{heldMidi.size ? pressure === 0 ? "KEYS HELD / WAITING FOR AIR" : `${heldMidi.size} ${heldMidi.size === 1 ? "REED" : "REEDS"} SOUNDING` : "READY TO PLAY"}</span>
            </div>
          </div>
          <div className="piano-toolbar">
            <RangeNavigator octave={state.octave} min={MIN_OCTAVE} max={MAX_OCTAVE} range={range} fullRange="C2–E7" shortcuts={state.shortcuts}
              onOctave={(octave) => controller.setOctave(octave)} onShortcut={(direction, code) => controller.setShortcut(direction, code)} />
          </div>
        </section>
        <section className="play-section" aria-label="Harmonium controls">
          <div className="section-heading controls-heading">
            <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
            <span className="control-hint">KEYS + AIR</span>
          </div>
          <div className="piano-controls">
            <div className="control-group">
              <div className="control-title"><span className="control-number">01</span><div><h3>Play the reeds</h3><p>Use the piano key mapping for notes and chords.<br />Keys stay held until you release them.</p></div></div>
              <div className="piano-control-example"><span className="keycap">A</span><span className="keycap">D</span><span className="keycap">G</span><span>C MAJOR / HOLD TOGETHER</span></div>
            </div>
            <div className="control-group">
              <div className="control-title"><span className="control-number">02</span><div><h3>Supply the air</h3><p>Hold Space in Manual pump mode while playing.<br />Choose Steady air to free both hands.</p></div></div>
              <div className="piano-control-example"><span className="keycap is-wide">SPACE</span><span>PUMP / RELEASE TO LET AIR FADE</span></div>
            </div>
            <div className="control-group">
              <div className="control-title"><span className="control-number">03</span><div><h3>Try the hinge</h3><p>Connect the sensor, then move the lid gently.<br />Watch the rate to judge its responsiveness.</p></div></div>
              <div className="piano-control-example"><span>ESC STOPS NOTES AND RESETS TO MANUAL PUMP</span></div>
            </div>
          </div>
          <p className="synth-source-note">An original synthesized reed approximation inspired by <a href="https://github.com/Rocktopus101/Hingemonium" target="_blank" rel="noreferrer">Hingemonium ↗</a>. Blur, tab hiding, and Stop sound clear the notes and air; a connected sensor stays available until disconnected or you switch instruments.</p>
        </section>
      </main>
    </div>
    <HingeSetupDialog open={setupOpen} onClose={() => setSetupOpen(false)} controller={controller} state={state} />
  </div>;
}
