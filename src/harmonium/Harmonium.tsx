import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { InstrumentSwitcher } from "../InstrumentSwitcher";
import type { Instrument } from "../InstrumentSwitcher";
import { HarmoniumController } from "./HarmoniumController";
import { HingeSetupGuide } from "./HingeSetupGuide";
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

export default function Harmonium({ onSelectInstrument }: { onSelectInstrument: (instrument: Instrument) => void }) {
  const controller = useMemo(() => new HarmoniumController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => { controller.attach(); return () => controller.dispose(); }, [controller]);
  const heldMidi = new Set(state.notes.map((note) => note.midi));
  const names = [...heldMidi].sort((a, b) => a - b).map(harmoniumNoteName);
  const range = `${harmoniumNoteName(harmoniumMidi(0, state.octave))} – ${harmoniumNoteName(harmoniumMidi(16, state.octave))}`;
  const pressure = Math.round(state.pressure * 100);
  const stale = state.readingAgeMs !== null && state.readingAgeMs > 1500;
  const rate = stale ? null : state.reading?.readingsPerSecond;
  const status = state.hinge.kind === "connected"
    ? !state.reading ? "Sensor connected. Move the lid to get the first reading."
      : stale ? "No recent readings. The sensor may be idle or slow; move the lid to check."
        : rate !== null && rate !== undefined && rate < 10 ? "Readings are slow. Hinge bellows may feel delayed; try manual pumping."
          : state.mode === "hinge" ? "Receiving lid readings. Move the lid while holding notes to build air pressure."
            : "Receiving lid readings. Select Hinge bellows to use lid movement for air pressure."
    : state.hinge.message;

  function pressKey(event: PointerEvent<HTMLButtonElement>, offset: number) {
    if (event.button !== 0) return;
    event.preventDefault();
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
      <header className="site-header">
        <div className="brand"><span className="brand-mark"><HarmoniumMark /></span><span>NERDBOARD<span className="brand-period">.</span></span></div>
        <InstrumentSwitcher selected="harmonium" onSelect={onSelectInstrument} />
        <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
          <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
        </div>
      </header>
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
                {state.hinge.kind !== "connected" && <p id="harmonium-hinge-help" className="harmonium-hinge-help">
                  Hinge bellows unlocks after you connect the built-in sensor. <a href="#harmonium-lid-setup">Setup instructions ↓</a>
                </p>}
                <p className="harmonium-mode-hint">{state.mode === "manual" ? "Hold Space or the pump button to fill the bellows. Air fades when you stop."
                  : state.mode === "steady" ? "A steady air supply lets you play freely with both hands."
                    : "Opening and closing the lid fills the bellows. Faster movement supplies more air over time."}</p>
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
            <div className="piano-octave-control">
              <span className="piano-toolbar-label">OCTAVE</span>
              <button type="button" className="piano-action" aria-label="Lower octave" disabled={state.octave === MIN_OCTAVE} onClick={() => controller.shiftOctave(-1)}>←</button>
              <span className="piano-octave-value" aria-live="polite">C{state.octave}</span>
              <button type="button" className="piano-action" aria-label="Higher octave" disabled={state.octave === MAX_OCTAVE} onClick={() => controller.shiftOctave(1)}>→</button>
              <span className="piano-toolbar-hint">ARROW KEYS / STARTS AT C3</span>
            </div>
            <button type="button" className="piano-action piano-stop" onClick={controller.stopAll}>STOP ALL <span>ESC</span></button>
          </div>
        </section>
        <section id="harmonium-lid-setup" className="harmonium-sensor" aria-label="Built-in lid sensor setup and diagnostics">
          <div className="harmonium-sensor-heading">
            <div><span className="synth-kicker">EXPERIMENTAL / MACBOOK HINGE</span><h2>Built-in lid sensor</h2></div>
            <div className="harmonium-sensor-actions">
              <button type="button" className="piano-action" disabled={["connecting", "connected", "unavailable"].includes(state.hinge.kind)} onClick={controller.connectHinge}>
                {state.hinge.kind === "connecting" ? "SELECT A SENSOR…" : state.hinge.kind === "connected" ? "CONNECTED" : "CONNECT LID SENSOR"}
              </button>
              {["connecting", "connected"].includes(state.hinge.kind) && <button type="button" className="piano-action" onClick={controller.disconnectHinge}>DISCONNECT</button>}
            </div>
          </div>
          <p className="harmonium-sensor-status" role="status">{status}</p>
          <HingeSetupGuide />
          <dl className="harmonium-diagnostics">
            <div><dt>LID ANGLE</dt><dd>{state.reading ? `${state.reading.angle.toFixed(0)}°` : "—"}</dd></div>
            <div><dt>LAST INTERVAL</dt><dd>{state.reading?.intervalMs != null ? `${Math.round(state.reading.intervalMs)} ms` : "—"}</dd></div>
            <div><dt>RECENT UPDATE RATE</dt><dd>{rate != null ? `${rate.toFixed(1)} Hz` : "—"}</dd></div>
            <div><dt>LAST READING</dt><dd>{state.readingAgeMs !== null ? `${(state.readingAgeMs / 1000).toFixed(1)} s ago` : "—"}</dd></div>
          </dl>
          <p className="harmonium-sensor-note">These values come from actual sensor reports. A changing angle confirms readings. An enabled Connect button only confirms browser support on this address; it does not confirm permission or sensor hardware. Manual pump and Steady air work without sensor permission.</p>
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
          <p className="synth-source-note">An original synthesized reed approximation inspired by <a href="https://github.com/Rocktopus101/Hingemonium" target="_blank" rel="noreferrer">Hingemonium ↗</a>. Blur, tab hiding, and Stop all clear the notes and air; a connected sensor stays available until disconnected or you switch instruments.</p>
        </section>
      </main>
      <footer><span>NERDBOARD / EXPERIMENT 005</span><span>REEDS / KEYS / BELLOWS</span></footer>
    </div>
  </div>;
}
