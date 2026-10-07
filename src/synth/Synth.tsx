import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { SynthController } from "./SynthController";
import { MAX_SYNTH_OCTAVE, MIN_SYNTH_OCTAVE, SYNTH_KEYS, synthMidi, synthNoteName } from "./model";
import type { SynthSettings } from "./model";
import { RangeNavigator } from "../RangeNavigator";
import { RANGE_SHORTCUTS } from "../preferences";

function SynthMark() {
  return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <rect x="3" y="5" width="30" height="27" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 17h28M11 18v13M18 18v13M25 18v13" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="10" cy="11" r="2" stroke="currentColor" />
    <path d="M17 11h10M8 18h6v7H8zM22 18h6v7h-6z" stroke="currentColor" fill="currentColor" />
  </svg>;
}

const TONE_CONTROLS: { key: keyof SynthSettings; label: string; max: number; min: number; step: number; unit: string; hint: string }[] = [
  { key: "brightness", label: "BRIGHTNESS", min: 0, max: 100, step: 1, unit: "%", hint: "DARK / BRIGHT" },
  { key: "decay", label: "DECAY", min: 100, max: 1000, step: 25, unit: " ms", hint: "SHORT / LONG" },
  { key: "echo", label: "ECHO", min: 0, max: 35, step: 1, unit: "%", hint: "ONE LIGHT REPEAT" },
];

export default function Synth() {
  const controller = useMemo(() => new SynthController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => { controller.attach(); return () => controller.dispose(); }, [controller]);
  const range = `${synthNoteName(synthMidi(0, state.octave))} – ${synthNoteName(synthMidi(16, state.octave))}`;
  const shortcutLabel = (code: string) => RANGE_SHORTCUTS.find((shortcut) => shortcut.code === code)?.label ?? code;

  function pressKey(event: PointerEvent<HTMLButtonElement>, offset: number) {
    if (event.button !== 0) return;
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea, select")) document.activeElement.blur();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.press(`pointer-${event.pointerId}`, offset);
  }
  function releaseKey(event: PointerEvent<HTMLButtonElement>) { controller.release(`pointer-${event.pointerId}`); }

  return <div className="app-shell synth-experience">
    <div className="small-screen-message">
      <SynthMark /><h1>Made for a keyboard.</h1>
      <p>This instrument is designed to be played on a larger screen with a physical keyboard.</p>
    </div>
    <div className="desktop-experience">
      <div className="instrument-audio-state">
        <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
          <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
        </div>
      </div>
      <main>
        <section className="instrument-section" aria-label="Virtual synthesizer">
          <div className="section-heading">
            <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
            <span className="tuning-label">MONO PLUCK <span>{range} · A4 = 440 Hz</span></span>
          </div>
          <div className="piano-instrument synth-instrument">
            <div className="synth-panel">
              <div className="synth-preset">
                <span className="synth-kicker">SYNTHESIZER / PRESET 01</span><h1>Alors-style pluck</h1>
                <p>A punchy, hollow pluck inspired by the opening of <em>Alors on danse</em>. Play one note at a time.</p>
                <button type="button" className="piano-action synth-reset" onClick={() => controller.resetPreset()}>RESET PRESET</button>
              </div>
              <div className="synth-tone-controls" role="group" aria-label="Pluck tone controls">
                {TONE_CONTROLS.map((control) => <label key={control.key} className="synth-slider">
                  <span>{control.label} <output>{state.settings[control.key]}{control.unit}</output></span>
                  <input type="range" aria-label={control.label} min={control.min} max={control.max} step={control.step}
                    value={state.settings[control.key]} onChange={(event) => controller.setSetting(control.key, Number(event.target.value))} />
                  <span className="synth-slider-hint">{control.hint}</span>
                </label>)}
              </div>
            </div>
            <div className="piano-keyboard" role="group" aria-label={`Synthesizer keyboard, ${range}`}>
              {SYNTH_KEYS.map((key) => {
                const midi = synthMidi(key.offset, state.octave);
                const name = synthNoteName(midi);
                const active = state.note?.midi === midi;
                return <button key={key.code} type="button"
                  className={`piano-key ${key.black ? "piano-black-key" : "piano-white-key"}${active ? " is-held" : ""}`}
                  style={{ "--key-index": key.whiteIndex } as CSSProperties}
                  aria-label={`${name}, keyboard ${key.key}`} aria-pressed={active}
                  onPointerDown={(event) => pressKey(event, key.offset)} onPointerUp={releaseKey}
                  onPointerCancel={releaseKey} onLostPointerCapture={releaseKey}
                  onClick={(event) => { if (event.detail === 0) controller.tap(key.offset); }}>
                  <span className="piano-note-label">{name}</span><span className="piano-key-label keyboard-hint">{key.key}</span>
                </button>;
              })}
            </div>
            <div className="piano-bottomline">
              <span className="piano-note-readout">{state.note ? synthNoteName(state.note.midi) : `C${state.octave} IS A / PLAY A SHORT, REPEATING PATTERN`}</span>
              <span className="play-indicator">PULSE / SUB / FILTER / ECHO</span>
            </div>
          </div>
          <RangeNavigator octave={state.octave} min={MIN_SYNTH_OCTAVE} max={MAX_SYNTH_OCTAVE} range={range} fullRange="C2–E7"
            shortcuts={state.shortcuts} onOctave={(octave) => controller.setOctave(octave)} onShortcut={(direction, code) => controller.setShortcut(direction, code)} />
          <div className="piano-toolbar">
          </div>
        </section>
        <section className="play-section" aria-label="Synthesizer controls">
          <div className="section-heading controls-heading">
            <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
            <span className="control-hint">START HERE <span className="hint-arrow">↘</span></span>
          </div>
          <div className="piano-controls">
            <div className="control-group">
              <div className="control-title"><span className="control-number">01</span><div><h3>Play the pluck</h3><p>Use the same keys as the piano, or click a key.<br />Each new note takes over the melody.</p></div></div>
              <div className="piano-control-example"><span className="keycap">A</span><span className="keycap">W</span><span className="keycap">S</span><span>C / C♯ / D</span></div>
            </div>
            <div className="control-group">
              <div className="control-title"><span className="control-number">02</span><div><h3>Shape the sound</h3><p>Brightness opens the filter. Decay shapes the fade.<br />Echo adds a repeat. Changes affect the next note.</p></div></div>
              <div className="piano-control-example"><span>RESET PRESET TO RETURN TO THE STARTING SOUND</span></div>
            </div>
            <div className="control-group">
              <div className="control-title"><span className="control-number">03</span><div><h3>Explore the range</h3><p>Tap {shortcutLabel(state.shortcuts.lower)} / {shortcutLabel(state.shortcuts.higher)} to move by an octave.<br />The sounding note keeps its pitch until you play another.</p></div></div>
              <div className="piano-control-example"><span className="keycap is-wide">{shortcutLabel(state.shortcuts.lower)}</span><span className="keycap is-wide">{shortcutLabel(state.shortcuts.higher)}</span><span>LOWER / HIGHER</span></div>
            </div>
          </div>
          <p className="synth-source-note">The original opening uses Reason’s NN-19 sampler. This preset recreates its character with synthesis; it is an approximation of the sound. <a href="https://www.reasonstudios.com/news/post/stromae" target="_blank" rel="noreferrer">Stromae’s breakdown ↗</a></p>
        </section>
      </main>
    </div>
  </div>;
}
