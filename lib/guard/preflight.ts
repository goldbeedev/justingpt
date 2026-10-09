import { DELIMITER_TAGS } from "@/lib/prompts/delimit";

export const MAX_MESSAGE_LENGTH = 1000;

export type PreflightFlag =
  | "ignore_instructions"
  | "prompt_extraction"
  | "persona_override"
  | "role_spoofing"
  | "delimiter_spoofing";

export type PreflightResult =
  | { ok: true; text: string; flags: PreflightFlag[] }
  | { ok: false; reason: "empty" | "too_long" };

// Invisible characters that can hide payloads or split keywords to dodge pattern matching.
const ZERO_WIDTH_AND_BIDI = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
// C0 controls and DEL, except tab (\u0009) and newline (\u000A).
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

// Within one clause: a verb like "ignore", a target like "previous", then a noun like "instructions".
const CLAUSE = "[^.?!\\n]";

/**
 * Cheap, LLM-free heuristics. A flag is a *signal* for the pipeline, not a block on its own:
 * "How did you design the system prompt for JustinGPT?" is a fair question about this project.
 */
const HEURISTICS: [PreflightFlag, RegExp[]][] = [
  [
    "ignore_instructions",
    [
      new RegExp(
        `\\b(ignore|disregard|forget|override)\\b${CLAUSE}{0,40}?\\b(previous|prior|above|earlier|preceding|all|your|the|these|system)\\b${CLAUSE}{0,30}?\\b(instructions?|rules|prompts?|directions|guidelines|constraints)\\b`,
        "i",
      ),
    ],
  ],
  [
    "prompt_extraction",
    [
      /\b(system|initial|hidden|original|developer)\s+(prompt|instructions|message)\b/i,
      new RegExp(
        `\\b(repeat|print|show|reveal|output|display|dump)\\b${CLAUSE}{0,30}?\\b(instructions|prompt|rules|(text|everything|words) above)\\b`,
        "i",
      ),
    ],
  ],
  [
    "persona_override",
    [
      /\b(you are now|you're now|from now on\b[^.?!\n]{0,20}\byou|pretend (to be|you are|you're)|roleplay as|developer mode|jailbreak|no (rules|restrictions|filters))\b/i,
      /\bDAN\b/, // Case-sensitive, so "Dan" the coworker doesn't trip it.
    ],
  ],
  [
    "role_spoofing",
    [/^\s*(system|assistant|developer)\s*:/im, /<\|im_(start|end)\|>/i, /\[\/?INST\]/i, /<\/?system>/i],
  ],
  ["delimiter_spoofing", [new RegExp(`<\\/?\\s*(${DELIMITER_TAGS.join("|")})\\b`, "i")]],
];

export function normalize(input: string): string {
  return input.normalize("NFKC").replace(ZERO_WIDTH_AND_BIDI, "").replace(CONTROL_CHARS, "").trim();
}

export function preflight(input: string): PreflightResult {
  const text = normalize(input);
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "too_long" };

  const flags = HEURISTICS.filter(([, patterns]) => patterns.some((p) => p.test(text))).map(
    ([flag]) => flag,
  );
  return { ok: true, text, flags };
}
