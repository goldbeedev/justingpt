export const DELIMITER_TAGS = ["user_message", "resume_data", "conversation_history"] as const;
export type DelimiterTag = (typeof DELIMITER_TAGS)[number];

// Matches the start of any of our delimiter tags, opening or closing, in any case.
const DELIMITER_PATTERN = new RegExp(`<(/?)\\s*(${DELIMITER_TAGS.join("|")})`, "gi");

/** A fresh per-request nonce, so delimiters can't be predicted from a previous response. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Neutralizes anything in `text` that looks like one of our delimiter tags. */
export function escapeDelimiters(text: string): string {
  return text.replace(DELIMITER_PATTERN, (_, slash: string, name: string) => `&lt;${slash}${name}`);
}

export function delimit(
  tag: DelimiterTag,
  content: string,
  nonce: string,
  attributes: Record<string, string> = {},
): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("");
  return `<${tag} id="${nonce}"${attrs}>\n${escapeDelimiters(content)}\n</${tag} id="${nonce}">`;
}
