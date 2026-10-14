"use client";

import { useState, useSyncExternalStore } from "react";
import { pickSuggestions, type SuggestionPool } from "@/lib/data/suggestions";

const COUNT = 4;
const noop = () => () => {};

/**
 * A random, well-rounded set of starter questions. Picked on the client so each visit
 * (and each new chat, which remounts this) gets a fresh set from the prerendered page.
 */
export function Suggestions({ pool, onPick }: { pool: SuggestionPool; onPick: (text: string) => void }) {
  // Server render and hydration show nothing, so the random picks can't cause a mismatch.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [picks] = useState(() => (typeof window === "undefined" ? [] : pickSuggestions(pool, COUNT)));

  if (!hydrated || picks.length === 0) return null;

  return (
    <ul aria-label="Suggested questions" className="suggestions mt-4 flex flex-wrap justify-center gap-2">
      {picks.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => onPick(question)}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            {question}
          </button>
        </li>
      ))}
    </ul>
  );
}
