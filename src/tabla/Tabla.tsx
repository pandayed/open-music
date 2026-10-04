import { useEffect, useMemo, useSyncExternalStore } from "react";
import { InstrumentSwitcher, type Instrument } from "../InstrumentSwitcher";
import { TablaController } from "./TablaController";
import { TABLA_PADS, TABLA_PRACTICE } from "./model";

function TablaMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <ellipse cx="10" cy="12" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="27" cy="15" rx="7" ry="3.5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="10" cy="12" rx="3" ry="1.5" fill="currentColor" />
      <ellipse cx="27" cy="15" rx="2.5" ry="1.3" fill="currentColor" />
      <path d="M2 12c0 13 2 18 8 18s8-5 8-18M20 15l2 14c2 3 8 3 10 0l2-14M6 16l1 11M14 16l-1 11M25 19v8M29 19v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Tabla({ onSelectInstrument }: { onSelectInstrument: (instrument: Instrument) => void }) {
  const controller = useMemo(() => new TablaController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);

  const lastPad = TABLA_PADS.find((pad) => pad.id === state.lastHit);

  return (
    <div className="app-shell tabla-experience">
      <div className="small-screen-message">
        <TablaMark />
        <h1>Made for a keyboard.</h1>
        <p>This instrument is designed to be played on a larger screen with a physical keyboard.</p>
      </div>
      <div className="desktop-experience">
        <header className="site-header">
          <div className="brand"><span className="brand-mark"><TablaMark /></span><span>NERDBOARD<span className="brand-period">.</span></span></div>
          <InstrumentSwitcher selected="tabla" onSelect={onSelectInstrument} />
          <div className={`audio-status${state.hasPlayed && !state.audioUnavailable ? " is-live" : ""}`} role="status">
            <span className="status-dot" />{state.audioUnavailable ? "AUDIO UNAVAILABLE" : state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}
          </div>
        </header>
        <main>
          <section className="instrument-section" aria-label="Virtual tabla">
            <div className="section-heading">
              <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
              <span className="tuning-label">TABLA <span>DAYAN · BAYAN · COMBINED</span></span>
            </div>
            <div className="drum-instrument tabla-instrument">
              <div className="drum-topline"><span>TABLA / PLAY WITH YOUR KEYBOARD OR MOUSE</span><span className="drum-tone">8 STROKES</span></div>
              <div className="drum-pads" role="group" aria-label="Tabla stroke pads">
                {TABLA_PADS.map((pad, index) => {
                  const active = state.activePads.includes(pad.id);
                  const sounding = state.soundingPads.includes(pad.id);
                  return (
                    <button key={pad.id} type="button"
                      className={`drum-pad tabla-pad tabla-pad-${pad.family}${active ? " is-hit" : ""}${sounding ? " is-ringing" : ""}`}
                      aria-label={`${pad.name}, ${pad.description}, keyboard ${pad.key}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        controller.hit(pad.id);
                      }}
                      onClick={(event) => { if (event.detail === 0) controller.hit(pad.id); }}
                    >
                      <span className="drum-pad-top"><span className="drum-pad-number">0{index + 1} / {pad.family === "both" ? "BOTH DRUMS" : pad.family.toUpperCase()}</span><span className="drum-ring-indicator" aria-hidden="true" /></span>
                      <span className="drum-face tabla-face" aria-hidden="true"><span className={`keycap${active ? " is-active" : ""}`}>{pad.key}</span></span>
                      <span className="drum-pad-name">{pad.name}</span>
                      <span className="drum-pad-description">{pad.description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="drum-bottomline">
                <span>{lastPad ? `LAST STROKE / ${lastPad.name.toUpperCase()}` : "DAYAN / TREBLE · BAYAN / BASS"}</span>
                <span className="play-indicator">{state.soundingPads.length ? `${state.soundingPads.length} STROKES RINGING` : "READY TO PLAY"}</span>
              </div>
            </div>
            <div className="drum-toolbar">
              <span className="drum-toolbar-hint">SYNTHESIZED TABLA / TAP AND RELEASE TO STRIKE AGAIN</span>
              <button type="button" className="drum-stop" onClick={controller.stopAll}>STOP ALL <span>ESC</span></button>
            </div>
          </section>
          <section className="play-section" aria-label="Tabla controls">
            <div className="section-heading controls-heading">
              <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
              <span className="control-hint">STROKE NAMES ARE CALLED BOLS</span>
            </div>
            <div className="drum-controls">
              <div className="control-group">
                <div className="control-title"><span className="control-number">01</span><div><h3>Dayan / treble drum</h3><p>Na, Tin, and Tun ring with different tones.<br />Te is a short, dry tap.</p></div></div>
                <div className="drum-control-example">{["A", "S", "D", "F"].map((key) => <span className="keycap" key={key}>{key}</span>)}<span>NA / TIN / TUN / TE</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">02</span><div><h3>Bayan / bass drum</h3><p>Ge gives a deep, open bass tone.<br />Ke gives a short, muted slap.</p></div></div>
                <div className="drum-control-example"><span className="keycap">J</span><span className="keycap">K</span><span>GE / KE</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">03</span><div><h3>Both drums together</h3><p>Dha combines Na and Ge; Dhin combines Tin and Ge.<br />You can also press individual stroke keys together.</p></div></div>
                <div className="drum-control-example"><span className="keycap">L</span><span className="keycap">;</span><span>DHA / DHIN</span></div>
              </div>
            </div>
          </section>
          <section className="song-lessons" aria-label="Tabla practice">
            <div className="section-heading controls-heading">
              <div className="section-heading-title"><span className="section-index">03</span><h2>TRY A RHYTHM</h2></div>
              <span className="control-hint">PLAY SLOWLY / REPEAT</span>
            </div>
            <div className="song-lesson-grid">
              {TABLA_PRACTICE.map((practice) => (
                <article className="song-lesson-card" key={practice.title}>
                  <div className="song-lesson-heading"><div><span className="song-lesson-kicker">PRACTICE LOOP</span><h3>{practice.title}</h3></div></div>
                  <p className="song-lesson-instruction">{practice.instruction}</p>
                  <div className="song-lesson-phrase"><span className="song-phrase-label">1–8</span><div className="song-phrase-steps">
                    {practice.strokes.map((bol, index) => {
                      const pad = TABLA_PADS.find((item) => item.id === bol)!;
                      return <span className="song-lesson-step" key={index}><span className="song-step-value">{pad.name}</span><span className="song-step-key">{pad.key}</span></span>;
                    })}
                  </div></div>
                  <p className="song-lesson-footer">STROKE : KEYBOARD KEY / ONE STROKE PER BEAT</p>
                </article>
              ))}
            </div>
          </section>
        </main>
        <footer><span>NERDBOARD / EXPERIMENT 006</span><span>TABLA / SYNTHESIZED PERCUSSION</span></footer>
      </div>
    </div>
  );
}
