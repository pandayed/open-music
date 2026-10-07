/** A single stop action silences the current instrument and practice transport. */
export const STOP_SOUND_EVENT = "nerdboard:stop-sound";
export function stopStudioSound(): void { window.dispatchEvent(new Event(STOP_SOUND_EVENT)); }
