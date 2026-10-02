import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { InstrumentSwitcher } from "../InstrumentSwitcher";
import type { Instrument } from "../InstrumentSwitcher";
import { SongLessons } from "../SongLessons";
import { PianoController } from "./PianoController";
import { MAX_OCTAVE, MIN_OCTAVE, PIANO_KEYS, pianoMidi, pianoNoteName } from "./model";

function PianoMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="28" height="25" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 7v23M18 7v23M25 7v23" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7h6v14H8zM22 7h6v14h-6z" fill="currentColor" />
    </svg>
  );
}

export default function Piano({ onSelectInstrument }: { onSelectInstrument: (instrument: Instrument) => void }) {
  const controller = useMemo(() => new PianoController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);

  const heldMidi = new Set(state.notes.filter((note) => note.held).map((note) => note.midi));
  const soundingMidi = new Set(state.notes.map((note) => note.midi));
  const range = `${pianoNoteName(pianoMidi(0, state.octave))} – ${pianoNoteName(pianoMidi(16, state.octave))}`;
  const soundingNames = [...soundingMidi].sort((a, b) => a - b).map(pianoNoteName);

  function pressKey(event: PointerEvent<HTMLButtonElement>, offset: number) {
    if (event.button !== 0) return;
    // Pointer playing does not move focus away from keyboard pedal controls.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.press(`pointer-${event.pointerId}`, offset);
  }

  function releaseKey(event: PointerEvent<HTMLButtonElement>) {
    controller.release(`pointer-${event.pointerId}`);
  }

  return (
    <div className="app-shell piano-experience">
      <div className="small-screen-message">
        <PianoMark />
        <h1>Made for a keyboard.</h1>
        <p>This instrument is designed to be played on a larger screen with a physical keyboard.</p>
      </div>

      <div className="desktop-experience">
        <header className="site-header">
          <div className="brand"><span className="brand-mark"><PianoMark /></span><span>NERDBOARD<span className="brand-period">.</span></span></div>
          <InstrumentSwitcher selected="piano" onSelect={onSelectInstrument} />
          <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
            <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
          </div>
        </header>

        <main>
          <section className="instrument-section" aria-label="Virtual piano">
            <div className="section-heading">
              <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
              <span className="tuning-label">17 KEYS <span>{range} · A4 = 440 Hz</span></span>
            </div>

            <div className="piano-instrument">
              <div className="piano-topline">
                <span>PIANO / PLAY WITH YOUR KEYBOARD OR MOUSE</span>
                <span className="piano-tone">HAMMER & HARMONICS</span>
              </div>
              <div className="piano-keyboard" role="group" aria-label={`Piano keyboard, ${range}`}>
                {PIANO_KEYS.map((key) => {
                  const midi = pianoMidi(key.offset, state.octave);
                  const name = pianoNoteName(midi);
                  const held = heldMidi.has(midi);
                  const sounding = soundingMidi.has(midi);
                  return (
                    <button
                      key={key.code}
                      type="button"
                      className={`piano-key ${key.black ? "piano-black-key" : "piano-white-key"}${held ? " is-held" : ""}${sounding && !held ? " is-sustained" : ""}`}
                      style={{ "--key-index": key.whiteIndex } as CSSProperties}
                      aria-label={`${name}, keyboard ${key.key}`}
                      aria-pressed={held}
                      onPointerDown={(event) => pressKey(event, key.offset)}
                      onPointerUp={releaseKey}
                      onPointerCancel={releaseKey}
                      onLostPointerCapture={releaseKey}
                      onClick={(event) => { if (event.detail === 0) controller.tap(key.offset); }}
                    >
                      <span className="piano-note-label">{name}</span>
                      <span className="piano-key-label">{key.key}</span>
                    </button>
                  );
                })}
              </div>
              <div className="piano-bottomline">
                <span className="piano-note-readout">{soundingNames.length ? soundingNames.join(" · ") : `C${state.octave} IS A / START ANYWHERE`}</span>
                <div className="neck-readout">
                  <span className={state.sustain ? "effect-live" : ""}>SUSTAIN {state.sustain ? "ON" : "OFF"}</span>
                  <span className="play-indicator">{soundingMidi.size ? `${soundingMidi.size} ${soundingMidi.size === 1 ? "NOTE" : "NOTES"} RINGING` : "READY TO PLAY"}</span>
                </div>
              </div>
            </div>

            <div className="piano-toolbar">
              <div className="piano-octave-control">
                <span className="piano-toolbar-label">OCTAVE</span>
                <button type="button" className="piano-action" aria-label="Lower octave" disabled={state.octave === MIN_OCTAVE} onClick={() => controller.shiftOctave(-1)}>←</button>
                <span className="piano-octave-value" aria-live="polite">C{state.octave}</span>
                <button type="button" className="piano-action" aria-label="Higher octave" disabled={state.octave === MAX_OCTAVE} onClick={() => controller.shiftOctave(1)}>→</button>
                <span className="piano-toolbar-hint">ARROW KEYS / C2 TO C6</span>
              </div>
              <div className="piano-pedal-control">
                <button type="button" className="piano-action piano-pedal" aria-pressed={state.sustain} onClick={() => controller.toggleSustain()}>
                  <span className="pedal-dot" /> SUSTAIN {state.sustain ? "ON" : "OFF"}
                </button>
                <button type="button" className="piano-action piano-stop" onClick={controller.stopAll}>STOP ALL <span>ESC</span></button>
              </div>
            </div>
          </section>

          <section className="play-section" aria-label="Piano controls">
            <div className="section-heading controls-heading">
              <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
              <span className="control-hint">START HERE <span className="hint-arrow">↘</span></span>
            </div>
            <div className="piano-controls">
              <div className="control-group">
                <div className="control-title"><span className="control-number">01</span><div><h3>Find your melody</h3><p>Home row for white keys. The row above for black.<br />Hold several keys together to play a chord.</p></div></div>
                <div className="piano-control-example"><span className="keycap">A</span><span className="keycap">D</span><span className="keycap">G</span><span>C MAJOR / TRY THESE TOGETHER</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">02</span><div><h3>Let it resonate</h3><p>Hold Space while playing to sustain released notes.<br />Or click Sustain to keep the pedal down.</p></div></div>
                <div className="piano-control-example"><span className={`keycap is-wide${state.sustain ? " is-active" : ""}`}>SPACE</span><span>RELEASE THE PEDAL TO DAMP THE NOTES</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">03</span><div><h3>Explore the range</h3><p>Use ← / → to move the keyboard by an octave.<br />Changing octave stops the current notes.</p></div></div>
                <div className="piano-control-example"><span className="keycap">←</span><span className="keycap">→</span><span>LOWER / HIGHER</span></div>
              </div>
            </div>
          </section>

          <SongLessons instrument="piano" />
        </main>

        <footer><span>NERDBOARD / EXPERIMENT 002</span><span>A LITTLE MELODY GOES A LONG WAY.</span></footer>
      </div>
    </div>
  );
}
