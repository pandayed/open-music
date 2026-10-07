import type { Instrument } from "../InstrumentSwitcher";
import type { PracticeExercise } from "./exercises";

export type PracticeProgress = {
  exerciseId: string;
  phrase: number;
  bpm: number;
  nextStep: number;
  completed: number;
  repeat: boolean;
  metronome: boolean;
};

export function loadProgress(instrument: Instrument, exercises: PracticeExercise[]): PracticeProgress {
  const fallback: PracticeProgress = { exerciseId: exercises[0].id, phrase: 0, bpm: 70, nextStep: 0, completed: 0, repeat: false, metronome: true };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(`nerdboard.practice.${instrument}.v1`) ?? "null");
    if (!raw || typeof raw !== "object") return fallback;
    const value = raw as Partial<PracticeProgress>;
    const exercise = exercises.find((candidate) => candidate.id === value.exerciseId) ?? exercises[0];
    const phrase = Number.isInteger(value.phrase) && value.phrase! >= 0 && value.phrase! < exercise.phrases.length ? value.phrase! : 0;
    return {
      exerciseId: exercise.id,
      phrase,
      bpm: typeof value.bpm === "number" && Number.isFinite(value.bpm) && value.bpm >= 40 && value.bpm <= 160 ? Math.round(value.bpm) : 70,
      nextStep: Number.isInteger(value.nextStep) && value.nextStep! >= 0 && value.nextStep! < exercise.phrases[phrase].steps.length ? value.nextStep! : 0,
      completed: Number.isInteger(value.completed) && value.completed! >= 0 && value.completed! <= 100000 ? value.completed! : 0,
      repeat: typeof value.repeat === "boolean" ? value.repeat : false,
      metronome: typeof value.metronome === "boolean" ? value.metronome : true,
    };
  } catch { return fallback; }
}

export function saveProgress(instrument: Instrument, value: PracticeProgress): boolean {
  try { localStorage.setItem(`nerdboard.practice.${instrument}.v1`, JSON.stringify(value)); return true; }
  catch { return false; }
}
