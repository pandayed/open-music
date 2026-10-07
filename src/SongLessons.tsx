import type { Instrument } from "./InstrumentSwitcher";
import { getSongLessons } from "./practice/lessons";

export function SongLessons({ instrument }: { instrument: Instrument }) {
  const lessons = getSongLessons(instrument);

  return (
    <section className="song-lessons" aria-label={`${instrument} song lessons`}>
      <div className="section-heading controls-heading">
        <div className="section-heading-title"><span className="section-index">03</span><h2>LEARN YOUR INSTRUMENT</h2></div>
        <span className="control-hint">BEGINNER FRIENDLY <span className="hint-arrow">↘</span></span>
      </div>
      <div className="song-lesson-grid">
        {lessons.map((lesson) => (
          <article className="song-lesson-card" key={lesson.title}>
            <div className="song-lesson-heading">
              <div><span className="song-lesson-kicker">PLAY ALONG</span><h3>{lesson.title}</h3></div>
              <span className="song-lesson-detail">{lesson.detail}</span>
            </div>
            <p className="song-lesson-instruction">{lesson.instruction}</p>
            <div className="song-lesson-phrases">
              {lesson.phrases.map((phrase) => (
                <div className="song-lesson-phrase" key={phrase.label}>
                  <span className="song-phrase-label">{phrase.label}</span>
                  <div className="song-phrase-steps">
                    {phrase.steps.map((item, index) => (
                      <span className="song-lesson-step" key={`${phrase.label}-${index}`}>
                        <span className="song-step-value">{item.value}</span>
                        <span className="song-step-key keyboard-hint">{item.key}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="song-lesson-footer">
              {instrument === "piano" || instrument === "synth" || instrument === "harmonium" ? "NOTE : KEYBOARD KEY" : instrument === "guitar" ? "CHORD : CHORD KEY" : "SOUND : PAD KEY"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
