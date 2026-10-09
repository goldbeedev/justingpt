"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode etc.): the toggle works, it just doesn't persist.
const memory = new Map<string, boolean>();

function read(key: string): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored === "1";
  } catch {
    // Fall through to memory.
  }
  return memory.get(key) ?? false;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A boolean preference persisted in localStorage; renders `false` on the server. */
export function useStoredToggle(key: string): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => false);
  const set = useCallback(
    (on: boolean) => {
      memory.set(key, on);
      try {
        localStorage.setItem(key, on ? "1" : "0");
      } catch {
        // Memory fallback already updated.
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, set];
}
