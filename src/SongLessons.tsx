import type { Instrument } from "./InstrumentSwitcher";

type LessonStep = { value: string; key: string };
type LessonPhrase = { label: string; steps: LessonStep[] };
type SongLesson = {
  title: string;
  detail: string;
  instruction: string;
  phrases: LessonPhrase[];
};

const pianoLessons: SongLesson[] = [
  {
    title: "Happy Birthday",
    detail: "MELODY IN G · START AT C4",
    instruction: "Play each note in order. Give the last note in each phrase a little extra time.",
    phrases: [
      { label: "01", steps: ["D4:S", "D4:S", "E4:D", "D4:S", "G4:G", "F♯4:T"].map(step) },
      { label: "02", steps: ["D4:S", "D4:S", "E4:D", "D4:S", "A4:H", "G4:G"].map(step) },
      { label: "03", steps: ["D5:L", "D5:L", "B4:J", "G4:G", "F♯4:T", "E4:D"].map(step) },
      { label: "04", steps: ["C5:K", "C5:K", "B4:J", "G4:G", "A4:H", "G4:G"].map(step) },
    ],
  },
  {
    title: "Ode to Joy",
    detail: "MELODY IN C · START AT C4",
    instruction: "Keep a steady beat. These white keys are all you need for this first melody.",
    phrases: [
      { label: "01", steps: ["E4:D", "E4:D", "F4:F", "G4:G", "G4:G", "F4:F", "E4:D", "D4:S"].map(step) },
      { label: "02", steps: ["C4:A", "C4:A", "D4:S", "E4:D", "E4:D", "D4:S", "D4:S"].map(step) },
      { label: "03", steps: ["E4:D", "E4:D", "F4:F", "G4:G", "G4:G", "F4:F", "E4:D", "D4:S"].map(step) },
      { label: "04", steps: ["C4:A", "C4:A", "D4:S", "E4:D", "D4:S", "C4:A", "C4:A"].map(step) },
    ],
  },
];

const guitarLessons: SongLesson[] = [
  {
    title: "Happy Birthday",
    detail: "EASY CHORDS IN G · G, D, C",
    instruction: "Hold the chord key, then tap Space for a down-strum. Change chords at each divider.",
    phrases: [
      { label: "01", steps: ["G:X", "G:X", "D:C", "G:X"].map(step) },
      { label: "02", steps: ["G:X", "G:X", "D:C", "G:X"].map(step) },
      { label: "03", steps: ["G:X", "G:X", "C:Z", "G:X"].map(step) },
      { label: "04", steps: ["D:C", "G:X", "D:C", "G:X"].map(step) },
    ],
  },
  {
    title: "Ode to Joy",
    detail: "TWO CHORDS IN C · C AND G",
    instruction: "Strum once per chord at an even pace. Repeat the four-chord phrase to practice changing shapes.",
    phrases: [
      { label: "LOOP", steps: ["C:Z", "C:Z", "G:X", "C:Z"].map(step) },
    ],
  },
];

const drumLessons: SongLesson[] = [
  {
    title: "We Will Rock You",
    detail: "STOMP · STOMP · CLAP",
    instruction: "Use the snare like a clap. Count 1, 2, 3, 4: kick on 1 and 2, snare on 3, leave 4 quiet, then repeat.",
    phrases: [
      { label: "LOOP", steps: ["Kick:A", "Kick:A", "Snare:S", "Rest:—"].map(step) },
    ],
  },
  {
    title: "Basic Rock Beat",
    detail: "4/4 · KICK, SNARE, CLOSED HAT",
    instruction: "Count 1, 2, 3, 4. Strike kick on 1 and 3, snare on 2 and 4, with the closed hi-hat on every beat.",
    phrases: [
      { label: "BAR", steps: ["Kick + hat:A + D", "Snare + hat:S + D", "Kick + hat:A + D", "Snare + hat:S + D"].map(step) },
    ],
  },
];

// Opening pluck, adapted to a C2/C3 practice register. Octave steps preserve
// the upward jumps while fitting the synth's 17-key keyboard.
const synthLessons: SongLesson[] = [
  {
    title: "Alors on danse",
    detail: "OPENING PLUCK · START AT C2",
    instruction: "From the default C3 octave, press ← once to start at C2. Play both rows in order, following the octave arrows, then repeat. Use short taps; release each key before pressing it again.",
    phrases: [
      { label: "C2", steps: ["G♯2:Y", "C♯3:O", "Octave C3:→"].map(step) },
      { label: "C3", steps: ["G♯3:Y", "G♯3:Y", "G♯3:Y", "E3:D", "A3:H", "D♯3:E", "D♯3:E", "D♯3:E", "Octave C2:←"].map(step) },
    ],
  },
];

function step(value: string): LessonStep {
  const [label, key] = value.split(":");
  return { value: label, key };
}

export function SongLessons({ instrument }: { instrument: Instrument }) {
  const lessons = instrument === "piano" ? pianoLessons
    : instrument === "guitar" ? guitarLessons
    : instrument === "synth" ? synthLessons : drumLessons;

  return (
    <section className="song-lessons" aria-label={`${instrument} song lessons`}>
      <div className="section-heading controls-heading">
        <div className="section-heading-title"><span className="section-index">03</span><h2>LEARN WITH A SONG</h2></div>
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
                        <span className="song-step-key">{item.key}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="song-lesson-footer">
              {instrument === "piano" || instrument === "synth" ? "NOTE : KEYBOARD KEY" : instrument === "guitar" ? "CHORD : CHORD KEY" : "SOUND : PAD KEY"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
