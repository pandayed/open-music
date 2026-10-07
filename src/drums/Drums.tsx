import { useEffect, useMemo, useSyncExternalStore } from "react";
import { DrumController } from "./DrumController";
import { DRUM_PADS } from "./model";

function DrumMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <ellipse cx="18" cy="13" rx="13" ry="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 13v12c0 3 6 5 13 5s13-2 13-5V13M11 17v10M25 17v10M9 4l18 10M27 4 9 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Drums() {
  const controller = useMemo(() => new DrumController(), []);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);

  const lastPad = DRUM_PADS.find((pad) => pad.id === state.lastHit);

  return (
    <div className="app-shell drum-experience">
      <div className="small-screen-message">
        <DrumMark />
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
          <section className="instrument-section" aria-label="Virtual drum kit">
            <div className="section-heading">
              <div className="section-heading-title"><span className="section-index">01</span><h2>THE INSTRUMENT</h2></div>
              <span className="tuning-label">8 SOUNDS <span>DRUMS · HATS · CYMBALS</span></span>
            </div>

            <div className="drum-instrument">
              <div className="drum-topline"><span>DRUM KIT / PLAY WITH YOUR KEYBOARD OR MOUSE</span><span className="drum-tone">FIND YOUR POCKET</span></div>
              <div className="drum-pads" role="group" aria-label="Drum pads">
                {DRUM_PADS.map((pad, index) => {
                  const active = state.activePads.includes(pad.id);
                  const sounding = state.soundingPads.includes(pad.id);
                  return (
                    <button
                      key={pad.id}
                      type="button"
                      className={`drum-pad drum-pad-${pad.family}${active ? " is-hit" : ""}${sounding ? " is-ringing" : ""}`}
                      aria-label={`${pad.name}, keyboard ${pad.key}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        controller.hit(pad.id);
                      }}
                      onClick={(event) => { if (event.detail === 0) controller.hit(pad.id); }}
                    >
                      <span className="drum-pad-top"><span className="drum-pad-number">0{index + 1}</span><span className="drum-ring-indicator" aria-hidden="true" /></span>
                      <span className={`drum-face drum-face-${pad.id}`} aria-hidden="true"><span className={`keycap${active ? " is-active" : ""}`}>{pad.key}</span></span>
                      <span className="drum-pad-name">{pad.name}</span>
                      <span className="drum-pad-description">{pad.description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="drum-bottomline">
                <span>{lastPad ? `LAST HIT / ${lastPad.name.toUpperCase()}` : "EIGHT SOUNDS / TWO HANDS / YOUR RHYTHM"}</span>
                <span className="play-indicator">{state.soundingPads.length ? `${state.soundingPads.length} ${state.soundingPads.length === 1 ? "SOUND" : "SOUNDS"} RINGING` : "READY TO PLAY"}</span>
              </div>
            </div>

            <div className="drum-toolbar">
              <span className="drum-toolbar-hint">TAP TO STRIKE / EACH HIT RINGS OUT</span>
            </div>
          </section>

          <section className="play-section" aria-label="Drum controls">
            <div className="section-heading controls-heading">
              <div className="section-heading-title"><span className="section-index">02</span><h2>THE CONTROLS</h2></div>
              <span className="control-hint">START HERE <span className="hint-arrow">↘</span></span>
            </div>
            <div className="drum-controls">
              <div className="control-group">
                <div className="control-title"><span className="control-number">01</span><div><h3>Build your beat</h3><p>Alternate kick and snare. Add closed hi-hats.<br />Press several keys together for a layered strike.</p></div></div>
                <div className="drum-control-example"><span className="keycap">A</span><span className="keycap">S</span><span className="keycap">D</span><span>KICK / SNARE / CLOSED HAT</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">02</span><div><h3>Open it up</h3><p>Strike the open hi-hat and let it ring.<br />The closed hi-hat cuts it short, like closing the pedal.</p></div></div>
                <div className="drum-control-example"><span className="keycap">F</span><span className="drum-example-arrow">→</span><span className="keycap">D</span><span>OPEN / CLOSE</span></div>
              </div>
              <div className="control-group">
                <div className="control-title"><span className="control-number">03</span><div><h3>Make a little noise</h3><p>Move between the toms for a fill.<br />Land on the crash, or keep time on the ride.</p></div></div>
                <div className="drum-control-example"><span className="keycap">J</span><span className="keycap">K</span><span className="keycap">L</span><span className="keycap">;</span><span>TOMS / CRASH / RIDE</span></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
