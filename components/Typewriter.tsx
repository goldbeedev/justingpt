"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Types `text` out one character at a time; renders it instantly for reduced-motion users. */
export function Typewriter({ text, msPerChar = 45 }: { text: string; msPerChar?: number }) {
  const reducedMotion = usePrefersReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setCount((current) => {
        if (current >= text.length) clearInterval(timer);
        return Math.min(current + 1, text.length);
      });
    }, msPerChar);
    return () => clearInterval(timer);
  }, [text, msPerChar, reducedMotion]);

  const shown = reducedMotion ? text : text.slice(0, count);

  return (
    <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown}
        <span className="typewriter-caret" />
      </span>
    </h1>
  );
}
