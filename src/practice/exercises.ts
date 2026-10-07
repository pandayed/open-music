import type { Instrument } from "../InstrumentSwitcher";
import { DRUM_PADS } from "../drums/model";
import { TABLA_PADS } from "../tabla/model";
import { getSongLessons } from "./lessons";

export type PracticeStep = { label: string; key: string; values: string[]; beats: number };
export type PracticePhrase = { label: string; steps: PracticeStep[] };
export type PracticeExercise = { id: string; title: string; instruction: string; phrases: PracticePhrase[] };

function noteMidi(label: string): string | null {
  const match = /^([A-G])([♯#]?)([0-8])$/.exec(label);
  if (!match) return null;
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1] as "C"];
  return String((Number(match[3]) + 1) * 12 + semitone + (match[2] ? 1 : 0));
}

export function performanceLabel(instrument: Instrument, value: string): string {
  if (instrument === "guitar") return value.startsWith("string-") ? `string ${Number(value.slice(7)) + 1}` : `${value} chord`;
  if (instrument === "drums") return DRUM_PADS.find((pad) => pad.id === value)?.name ?? value;
  if (instrument === "tabla") return TABLA_PADS.find((pad) => pad.id === value)?.name ?? value;
  const midi = Number(value);
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return Number.isInteger(midi) && midi >= 21 && midi <= 108 ? `${names[midi % 12]}${Math.floor(midi / 12) - 1}` : value;
}

export function getPracticeExercises(instrument: Instrument): PracticeExercise[] {
  return getSongLessons(instrument).map((lesson, lessonIndex) => ({
    id: `${instrument}-${lessonIndex}`,
    title: lesson.title,
    instruction: lesson.instruction,
    phrases: lesson.phrases.map((phrase) => ({
      label: phrase.label,
      steps: phrase.steps.filter((item) => !item.value.startsWith("Octave ")).map((item) => {
        const note = noteMidi(item.value);
        let values: string[] = [];
        if (note !== null) values = [note];
        else if (instrument === "guitar") values = [item.value];
        else if (instrument === "tabla") values = [item.value.toLowerCase()];
        else if (instrument === "drums") {
          values = item.value === "Rest" ? [] : item.value.includes(" + hat")
            ? [item.value.startsWith("Kick") ? "kick" : "snare", "closed-hat"]
            : [DRUM_PADS.find((pad) => pad.name === item.value)?.id ?? "kick"];
        }
        return { label: item.value, key: item.key, values, beats: item.beats };
      }),
    })),
  }));
}
