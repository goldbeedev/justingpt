import { createNonce } from "@/lib/prompts/delimit";

/** A per-request secret planted in the system prompt; seeing it in output means the prompt leaked. */
export function createCanary(): string {
  return `CANARY-${createNonce()}`;
}

export interface CanaryScanner {
  /** Returns text that is safe to send now. Once `leaked` is true, nothing more is released. */
  push(chunk: string): { safe: string; leaked: boolean };
  /** Releases any held-back text at the end of a clean stream. */
  flush(): string;
}

/**
 * Scans streamed output for the canary without ever releasing part of it: any trailing text
 * that could be the start of the canary is held back until the next chunk settles it.
 */
export function createCanaryScanner(canary: string): CanaryScanner {
  let held = "";
  let tripped = false;

  return {
    push(chunk) {
      if (tripped) return { safe: "", leaked: true };

      const text = held + chunk;
      const index = text.indexOf(canary);
      if (index !== -1) {
        tripped = true;
        held = "";
        return { safe: text.slice(0, index), leaked: true };
      }

      const keep = partialMatchLength(text, canary);
      held = text.slice(text.length - keep);
      return { safe: text.slice(0, text.length - keep), leaked: false };
    },
    flush() {
      const rest = tripped ? "" : held;
      held = "";
      return rest;
    },
  };
}

/** Length of the longest suffix of `text` that is a proper prefix of `canary`. */
function partialMatchLength(text: string, canary: string): number {
  for (let n = Math.min(text.length, canary.length - 1); n > 0; n--) {
    if (canary.startsWith(text.slice(-n))) return n;
  }
  return 0;
}
