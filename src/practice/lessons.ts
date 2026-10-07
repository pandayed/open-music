import type { Instrument } from "../InstrumentSwitcher";
import { TABLA_PADS, TABLA_PRACTICE } from "../tabla/model";

export type LessonStep = { value: string; key: string; beats: number };
export type LessonPhrase = { label: string; steps: LessonStep[] };
export type SongLesson = {
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
      { label: "03", steps: ["D4:S", "D4:S", "D5:L", "B4:J", "G4:G", "F♯4:T", "E4:D"].map(step) },
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
    instruction: "Select C2 in the keyboard range for the first phrase, then C3 for the second. Play the notes in order and use the range controls when changing phrases. Use short taps; release each key before pressing it again.",
    phrases: [
      { label: "C2", steps: ["G♯2:Y", "C♯3:O", "Octave C3:Higher range"].map(step) },
      { label: "C3", steps: ["G♯3:Y", "G♯3:Y", "G♯3:Y", "E3:D", "A3:H", "D♯3:E", "D♯3:E", "D♯3:E", "Octave C2:Lower range"].map(step) },
    ],
  },
];

function step(value: string): LessonStep {
  const [label, key] = value.split(":");
  return { value: label, key, beats: 1 };
}

// Duration is in quarter-note beats; the opening repeated notes are pickups.
const birthdayBeats = [0.5, 0.5, 1, 1, 1, 2];
pianoLessons[0].phrases.forEach((phrase) => {
  const beats = phrase.steps.length === 7 ? [0.5, 0.5, 1, 1, 1, 1, 1] : birthdayBeats;
  phrase.steps.forEach((item, index) => { item.beats = beats[index]; });
});
pianoLessons[1].phrases.forEach((phrase, phraseIndex) => {
  const beats = phraseIndex === 1 || phraseIndex === 3 ? [1, 1, 1, 1, 1.5, 0.5, 2] : [1, 1, 1, 1, 1, 1, 1, 1];
  phrase.steps.forEach((item, index) => { item.beats = beats[index]; });
});
synthLessons[0].phrases.forEach((phrase) => {
  phrase.steps.forEach((item) => { item.beats = item.value.startsWith("Octave ") ? 0 : 0.5; });
});


const harmoniumLessons: SongLesson[] = [
  ...pianoLessons,
  {
    title: "Keep the air flowing",
    detail: "BELLOWS · STEADY REED TONE",
    instruction: "Choose Manual pump, Steady air, or calibrated Hinge control. Hold C4 for four beats. With manual or hinge control, use gentle repeated strokes before the air meter empties. Aim for an even tone, rather than maximum pressure.",
    phrases: [{ label: "HOLD", steps: [{ value: "C4", key: "A", beats: 4 }, { value: "D4", key: "S", beats: 4 }, { value: "E4", key: "D", beats: 4 }] }],
  },
];

const tablaLessons: SongLesson[] = TABLA_PRACTICE.map((exercise) => ({
  title: exercise.title,
  detail: "STROKES · ONE BOL PER BEAT",
  instruction: exercise.instruction + " A bol is the spoken name of a stroke. Listen to the difference between the ringing and muted sounds. These are short coordination exercises, not a complete traditional taal lesson.",
  phrases: [{ label: "LOOP", steps: exercise.strokes.map((bol) => ({
    value: TABLA_PADS.find((pad) => pad.id === bol)!.name,
    key: TABLA_PADS.find((pad) => pad.id === bol)!.key,
    beats: 1,
  })) }],
}));

export function getSongLessons(instrument: Instrument): SongLesson[] {
  return { piano: pianoLessons, synth: synthLessons, guitar: guitarLessons,
    drums: drumLessons, harmonium: harmoniumLessons, tabla: tablaLessons }[instrument];
}
