import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { PointerEvent } from "react";
import { GuitarController } from "./guitar/GuitarController";
import { CHORDS, FRETS, STRINGS, noteName } from "./guitar/model";

function GuitarMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M4 10h28M4 18h28M4 26h28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 5v26M25 5v26" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="18" cy="18" r="3.2" fill="currentColor" />
    </svg>
  );
}

function Keycap({ children, active = false, wide = false }: { children: string; active?: boolean; wide?: boolean }) {
  return <span className={`keycap${active ? " is-active" : ""}${wide ? " is-wide" : ""}`}>{children}</span>;
}

export default function Guitar() {
  const controller = useMemo(() => new GuitarController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);

  const selectedChord = CHORDS.find((chord) => chord.code === state.chordCode);
  const selectedFret = FRETS.find((fret) => fret.code === state.fretCode);
  const activeByString = new Map(state.notes.map((note) => [note.stringIndex, note]));

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (controller.startBend(event.clientX)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) controller.moveBend(event.clientX);
  }

  function handlePointerEnd() {
    controller.endBend();
    setDragging(false);
  }

  return (
    <div className="app-shell">
      <div className="small-screen-message">
        <GuitarMark />
        <h1>Made for a keyboard.</h1>
        <p>This instrument is designed to be played on a larger screen with a physical keyboard.</p>
      </div>

      <div className="desktop-experience">
        <div className="instrument-audio-state">
          <div className={`audio-status${state.hasPlayed ? " is-live" : ""}`}><span className="status-dot" />{state.hasPlayed ? "AUDIO LIVE" : "PRESS A KEY TO BEGIN"}</div>
        </div>

        <main>
          <section className="instrument-section" aria-label="Virtual guitar">
            <div className="section-heading">
              <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
              <span className="tuning-label">STANDARD TUNING <span>E · A · D · G · B · e</span></span>
            </div>

            <div
              className={`instrument${dragging ? " is-dragging" : ""}${state.notes.length ? " is-playing" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              aria-label="Guitar fretboard. Hold a note and drag horizontally here to bend pitch."
            >
              <div className="neck-topline">
                <span>STRINGS / PICK WITH TOP ROW</span>
                <div className="fret-ruler">
                  {FRETS.map((fret) => <span key={fret.code} className={state.fretCode === fret.code ? "is-selected" : ""}><b>{fret.key}</b>{fret.label}</span>)}
                </div>
              </div>

              <div className="neck-body">
                <div className="string-heads">
                  {STRINGS.map((string, index) => {
                    const isActive = activeByString.has(index);
                    const muted = selectedChord?.frets[index] === -1;
                    return <div key={string.code} className={`string-head${isActive ? " is-active" : ""}${muted ? " is-muted" : ""}`}>
                      <span className="string-key">{string.key}</span>
                      <span className="string-name">{string.name}</span>
                      <span className="string-head-line" />
                    </div>;
                  })}
                </div>

                <div className="fretboard" role="img" aria-label="Six strings and four playable frets">
                  {STRINGS.flatMap((string, stringIndex) =>
                    FRETS.map(({ fret }) => {
                      const active = activeByString.get(stringIndex)?.fret === fret;
                      const suggested = selectedChord
                        ? selectedChord.frets[stringIndex] === fret
                        : selectedFret?.fret === fret;
                      return <div key={`${string.code}-${fret}`} className={`note-cell string-${stringIndex}${fret === 0 ? " is-open" : ""}${active ? " is-sounding" : ""}${suggested ? " is-shaped" : ""}`}>
                        <span className="note-position"><span className="note-name">{noteName(stringIndex, fret)}</span></span>
                      </div>;
                    }),
                  )}
                  <span className="inlay inlay-one" /><span className="inlay inlay-two" />
                </div>
              </div>

              <div className="neck-bottomline">
                <span>{selectedChord ? `${selectedChord.name} CHORD / HOLD ${selectedChord.key}` : selectedFret ? `${selectedFret.label} / HOLD ${selectedFret.key}` : "OPEN STRINGS / HOLD A FRET OR CHORD KEY"}</span>
                <div className="neck-readout">
                  {state.vibrato && <span className="effect-live">VIBRATO ON</span>}
                  <span className={Math.abs(state.bend) > 0.02 ? "effect-live" : ""}>BEND {state.bend >= 0 ? "+" : ""}{state.bend.toFixed(1)} ST</span>
                  <span className="play-indicator">{state.notes.length ? `${state.notes.length} ${state.notes.length === 1 ? "STRING" : "STRINGS"} RINGING` : "READY TO PLAY"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="play-section" aria-label="Keyboard controls">
            <div className="section-heading controls-heading">
              <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
              <span className="control-hint">START HERE <span className="hint-arrow">↘</span></span>
            </div>

            <div className="controls-main">
              <div className="control-group string-controls">
                <div className="control-title"><span className="control-number">01</span><div><h3>Pick a string</h3><p>Top row · one key for each string</p></div></div>
                <div className="key-row">
                  {STRINGS.map((string, index) => <div className="mapped-key" key={string.code}><Keycap active={activeByString.has(index)}>{string.key}</Keycap><span>{string.name}</span></div>)}
                </div>
              </div>

              <div className="control-group fret-controls">
                <div className="control-title"><span className="control-number">02</span><div><h3>Hold a fret</h3><p>Home row · then pick any string</p></div></div>
                <div className="key-row">
                  {FRETS.map((fret) => <div className="mapped-key" key={fret.code}><Keycap active={state.fretCode === fret.code}>{fret.key}</Keycap><span>{fret.fret === 0 ? "OPEN" : `0${fret.fret}`}</span></div>)}
                </div>
              </div>

              <div className="control-group chord-controls">
                <div className="control-title"><span className="control-number">03</span><div><h3>Hold a chord</h3><p>Bottom row · hold a shape, then strum</p></div></div>
                <div className="key-row chord-key-row">
                  {CHORDS.map((chord) => <div className="mapped-key" key={chord.code}><Keycap active={state.chordCode === chord.code}>{chord.key}</Keycap><span>{chord.name}</span></div>)}
                </div>
              </div>
            </div>

            <div className="gesture-strip">
              <div className="gesture"><Keycap wide active={state.stroke === "down"}>SPACE</Keycap><span>STRUM DOWN</span></div>
              <div className="gesture"><Keycap wide active={state.stroke === "up"}>SHIFT</Keycap><span>+</span><Keycap wide active={state.stroke === "up"}>SPACE</Keycap><span>STRUM UP</span></div>
              <div className="gesture"><Keycap active={state.vibrato}>H</Keycap><span>HOLD FOR VIBRATO</span></div>
              <div className="gesture gesture-bend"><span className="drag-icon">↔</span><span>DRAG ON THE NECK TO BEND</span></div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
