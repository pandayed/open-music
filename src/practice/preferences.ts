import { useSyncExternalStore } from "react";

const HINTS_KEY = "nerdboard.keyboard-hints.v1";
const CHANGE = "nerdboard-keyboard-hints";

function storedHints(): boolean {
  try { return localStorage.getItem(HINTS_KEY) !== "hide"; } catch { return true; }
}
let currentHints = storedHints();
const readHints = () => currentHints;

function subscribe(listener: () => void): () => void {
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== HINTS_KEY && event.key !== null) return;
    currentHints = storedHints();
    listener();
  };
  window.addEventListener(CHANGE, listener);
  window.addEventListener("storage", storageChanged);
  return () => {
    window.removeEventListener(CHANGE, listener);
    window.removeEventListener("storage", storageChanged);
  };
}

export function useKeyboardHints(): [boolean, (shown: boolean) => void] {
  const shown = useSyncExternalStore(subscribe, readHints, () => true);
  return [shown, (next) => {
    currentHints = next;
    try { localStorage.setItem(HINTS_KEY, next ? "show" : "hide"); } catch { /* Optional preference. */ }
    window.dispatchEvent(new Event(CHANGE));
  }];
}
