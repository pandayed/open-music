import type { Instrument } from "../InstrumentSwitcher";

export type PerformanceHit = { instrument: Instrument; value: string; timestamp: number };
const listeners = new Set<(hit: PerformanceHit) => void>();

/** Called only after a real instrument action succeeds, never for reference playback. */
export function publishPerformance(instrument: Instrument, value: string): void {
  const hit = { instrument, value, timestamp: performance.now() };
  for (const listener of listeners) listener(hit);
}

export function subscribePerformance(listener: (hit: PerformanceHit) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
