const GENERIC = "Something went wrong. Please try again.";
const MAX_DISPLAYED_LENGTH = 200;

export interface ChatErrorInfo {
  message: string;
  /** Whether retrying the same message could succeed. */
  retryable: boolean;
}

/**
 * Turns a useChat error into something a visitor can act on. HTTP errors arrive with the JSON
 * body as the message; stream errors arrive with the server's already-friendly text.
 */
export function describeChatError(error: Error): ChatErrorInfo {
  if (error instanceof TypeError) {
    return { message: "Couldn't reach the server. Check your connection and try again.", retryable: true };
  }

  let body: { error?: string; message?: string } | undefined;
  try {
    body = JSON.parse(error.message);
  } catch {
    // Not JSON: a stream error chunk or something unexpected.
  }

  if (body?.error === "rate_limited") {
    return { message: body.message ?? "You're sending messages quickly. Try again in a few minutes.", retryable: false };
  }
  if (body?.error === "payload_too_large") {
    return { message: "This conversation got too long. Start a new chat to keep going.", retryable: false };
  }
  if (body) return { message: body.message ?? GENERIC, retryable: true };

  const raw = error.message.trim();
  const readable = raw.length > 0 && raw.length <= MAX_DISPLAYED_LENGTH;
  return { message: readable ? raw : GENERIC, retryable: true };
}
