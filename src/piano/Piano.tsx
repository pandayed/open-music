import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { PianoController } from "./PianoController";
import { RangeNavigator } from "../RangeNavigator";
import { MAX_OCTAVE, MIN_OCTAVE, MIN_PIANO_MIDI, MAX_PIANO_MIDI, PIANO_KEYS, pianoMidi, pianoNoteName, isPianoMidi } from "./model";
import { RANGE_SHORTCUTS } from "../preferences";

function PianoMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="28" height="25" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 7v23M18 7v23M25 7v23" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7h6v14H8zM22 7h6v14h-6z" fill="currentColor" />
    </svg>
  );
}

export default function Piano() {
  const controller = useMemo(() => new PianoController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);

  const heldMidi = new Set(state.notes.filter((note) => note.held).map((note) => note.midi));
  const soundingMidi = new Set(state.notes.map((note) => note.midi));
  const firstMidi = Math.max(MIN_PIANO_MIDI, pianoMidi(0, state.octave));
  const range = `${pianoNoteName(firstMidi)} – ${pianoNoteName(Math.min(MAX_PIANO_MIDI, pianoMidi(16, state.octave)))}`;
  const shortcutLabel = (code: string) => RANGE_SHORTCUTS.find((shortcut) => shortcut.code === code)?.label ?? code;
  const soundingNames = [...soundingMidi].sort((a, b) => a - b).map(pianoNoteName);

  function pressKey(event: PointerEvent<HTMLButtonElement>, offset: number) {
    if (event.button !== 0) return;
    // Resume physical-key playing after adjusting a shortcut select.
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea, select")) document.activeElement.blur();
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
        <div className="instrument-audio-state">
          <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
            <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
          </div>
        </div>

        <main>
          <section className="instrument-section" aria-label="Virtual piano">
            <div className="section-heading">
              <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
              <span className="tuning-label">88-NOTE RANGE <span>{range} · A4 = 440 Hz</span></span>
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
                  const playable = isPianoMidi(midi);
                  return (
                    <button
                      key={key.code}
                      type="button"
                      className={`piano-key ${key.black ? "piano-black-key" : "piano-white-key"}${held ? " is-held" : ""}${sounding && !held ? " is-sustained" : ""}`}
                      style={{ "--key-index": key.whiteIndex } as CSSProperties}
                      aria-label={playable ? `${name}, keyboard ${key.key}` : `${name}, outside the piano range`}
                      aria-pressed={held}
                      disabled={!playable}
                      onPointerDown={(event) => pressKey(event, key.offset)}
                      onPointerUp={releaseKey}
                      onPointerCancel={releaseKey}
                      onLostPointerCapture={releaseKey}
                      onClick={(event) => { if (event.detail === 0) controller.tap(key.offset); }}
                    >
                      <span className="piano-note-label">{name}</span>
                      <span className="piano-key-label keyboard-hint">{key.key}</span>
                    </button>
                  );
                })}
              </div>
              <div className="piano-bottomline">
                <span className="piano-note-readout">{soundingNames.length ? soundingNames.join(" · ") : `${pianoNoteName(firstMidi)} / START ANYWHERE`}</span>
                <div className="neck-readout">
                  <span className={state.sustain ? "effect-live" : ""}>SUSTAIN {state.sustain ? "ON" : "OFF"}</span>
                  <span className="play-indicator">{soundingMidi.size ? `${soundingMidi.size} ${soundingMidi.size === 1 ? "NOTE" : "NOTES"} RINGING` : "READY TO PLAY"}</span>
                </div>
              </div>
            </div>

            <RangeNavigator octave={state.octave} min={MIN_OCTAVE} max={MAX_OCTAVE} range={range} fullRange="A0–C8"
              bankLabel={(bank) => bank === MIN_OCTAVE ? "A0" : `C${bank}`} shortcuts={state.shortcuts}
              onOctave={(octave) => controller.setOctave(octave)} onShortcut={(direction, code) => controller.setShortcut(direction, code)} />
            <div className="piano-toolbar">
              <div className="piano-pedal-control">
                <button type="button" className="piano-action piano-pedal" aria-pressed={state.sustain} onClick={() => controller.toggleSustain()}>
                  <span className="pedal-dot" /> SUSTAIN {state.sustain ? "ON" : "OFF"}
                </button>
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
                <div className="control-title"><span className="control-number">03</span><div><h3>Explore the range</h3><p>Tap {shortcutLabel(state.shortcuts.lower)} / {shortcutLabel(state.shortcuts.higher)} to move by an octave.<br />Held notes and sustain continue while you change range.</p></div></div>
                <div className="piano-control-example"><span className="keycap is-wide">{shortcutLabel(state.shortcuts.lower)}</span><span className="keycap is-wide">{shortcutLabel(state.shortcuts.higher)}</span><span>LOWER / HIGHER</span></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
