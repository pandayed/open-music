import type { Instrument } from "./InstrumentSwitcher";
import { CHORDS, FRETS, STRINGS } from "./guitar/model";
import { DRUM_PADS } from "./drums/model";
import { TABLA_PADS } from "./tabla/model";

const guides: Record<Instrument, { title: string; start: string; tips: string[]; lesson: string }> = {
  piano: {
    title: "Find your first melody", start: "White notes use A S D F G H J K L ;. Black notes use W E T Y U O P.",
    tips: ["Hold several notes to play a chord. Try A + D + G at C4 for C major.", "Hold Space for sustain, or latch the Sustain button.", "Tap the lower or higher shortcut shown below the keys. The defaults are Left and Right Shift. Held notes and sustain continue.", "Choose a range below the keys. The piano covers A0–C8; shaded keys at the ends are outside its range."],
    lesson: "A chord combines notes. A major triad uses a root, the note four semitones above it, and the note seven semitones above it. Practise each note separately, then together. Listen to the difference between releasing the keys and releasing the sustain pedal.",
  },
  synth: {
    title: "Shape a sound", start: "Use the same white and black note positions as the piano. Start at C3 for the pluck preset.",
    tips: ["Tap and release to retrigger. This preset plays one lead note at a time.", "Brightness changes the tone; Decay changes how long a note fades; Echo adds a repeat.", "Tap the range shortcuts shown below the keys. The defaults are Left and Right Shift. The current note finishes normally.", "Reset preset restores the tone and starting range."],
    lesson: "A pluck has a quick beginning and a fading body. Start with a slow repeated note, then change one setting at a time. Listen to how brightness changes the harmonics and decay changes the space between notes.",
  },
  harmonium: {
    title: "Notes and a breath of air", start: "Play white notes with the home row and black notes with the row above. Hold notes while supplying air.",
    tips: ["Manual pump: hold Space or the pump button to build air.", "Steady air frees both hands for melodies and chords.", "Hinge bellows uses a compatible lid sensor. Open setup to check access, connect and calibrate gentle movement.", "Sensitivity changes air per movement; retention changes its fade. Volume is separate.", "The range shortcuts below the keys change range without releasing held notes. They default to Left and Right Shift."],
    lesson: "The reeds sound only while air is available. Hold one note and practise maintaining a smooth sound through several gentle pumps. Then play a phrase while keeping the airflow even. Steady air helps you work on melody separately from bellows control.",
  },
  guitar: {
    title: "Pick, shape, strum", start: "Hold a fret or chord shape, then pick a string or strum with Space.",
    tips: ["Q W E R T Y pick the six strings, from low E to high E.", "A S D F G select open string or frets 1–4.", "Z X C V B N M select C, G, D, A, E, Am, Em chord shapes.", "Space strums down; Shift + Space strums up. Hold H for vibrato.", "Drag horizontally on the fretboard while a note sounds to bend its pitch."],
    lesson: "Start by hearing each string open. Hold a chord shape and pick its strings individually before strumming. Keep a steady pulse as you change between two shapes. These are virtual controls; physical hand placement is a separate skill on an acoustic instrument.",
  },
  drums: {
    title: "Build a steady pulse", start: "Tap a mapped key or a pad. Release and tap again for the next hit.",
    tips: ["A S D F: kick, snare, closed and open hi-hat.", "J K L ;: high tom, low tom, crash and ride.", "Play pads together to combine sounds. Closed hi-hat cuts off the open hi-hat.", "Try kick on beats 1 and 3, snare on 2 and 4, with hi-hat on every beat."],
    lesson: "Count four even beats aloud. Keep the hi-hat steady, then add kick and snare. Work at a tempo where the hits stay even before increasing it. In Practice, the count-in gives you time to place your hands before the first beat.",
  },
  tabla: {
    title: "Say it, then play it", start: "Learn each bol by its name and sound, then combine strokes into an even rhythm.",
    tips: ["A S D F: Na, Tin, Tun, Te on the dayan.", "J K: Ge and Ke on the bayan.", "L plays Dha (Na + Ge); ; plays Dhin (Tin + Ge). Individual strokes can also sound together.", "Release between repeated taps. Focus a pad and use Enter or Space to strike it."],
    lesson: "Say the stroke names evenly before playing them. Hear how an open ringing stroke differs from a short muted one. The practice loops introduce coordination; they are not a complete traditional taal curriculum or a replacement for learning hand technique.",
  },
};

export function InstrumentGuide({ instrument, compact = false }: { instrument: Instrument; compact?: boolean }) {
  const guide = guides[instrument];
  return <section className="instrument-guide" aria-label={`${instrument} playing guide`}>
    <span className="studio-eyebrow">{compact ? "AT YOUR FINGERTIPS" : "GET TO KNOW YOUR INSTRUMENT"}</span>
    <h2>{guide.title}</h2>
    <p>{guide.start}</p>
    <ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
    {instrument === "guitar" && <details><summary>All string, fret and chord controls</summary>
      <div className="guide-map">{STRINGS.map((item) => <span key={item.code}><kbd>{item.key}</kbd>{item.name}</span>)}</div>
      <div className="guide-map">{FRETS.map((item) => <span key={item.code}><kbd>{item.key}</kbd>{item.label}</span>)}</div>
      <div className="guide-map">{CHORDS.map((item) => <span key={item.code}><kbd>{item.key}</kbd>{item.name}</span>)}</div>
    </details>}
    {(instrument === "drums" || instrument === "tabla") && <div className="guide-map">{(instrument === "drums" ? DRUM_PADS : TABLA_PADS).map((pad) => <span key={pad.id}><kbd>{pad.key}</kbd>{pad.name}</span>)}</div>}
    {!compact && <div className="guide-listening"><h3>Listen as you learn</h3><p>{guide.lesson}</p></div>}
    <p className="guide-stop"><kbd>Esc</kbd> stops the instrument. Switching instruments also stops its sound.</p>
  </section>;
}
