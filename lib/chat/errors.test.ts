import { describe, expect, it } from "vitest";
import { describeChatError } from "./errors";

describe("describeChatError", () => {
  it("explains rate limiting using the server's message", () => {
    const error = new Error(JSON.stringify({ error: "rate_limited", message: "Slow down a bit." }));
    expect(describeChatError(error)).toEqual({ message: "Slow down a bit.", retryable: false });
  });

  it("explains oversized conversations and suggests a new chat", () => {
    const error = new Error(JSON.stringify({ error: "payload_too_large" }));
    expect(describeChatError(error)).toEqual({
      message: "This conversation got too long. Start a new chat to keep going.",
      retryable: false,
    });
  });

  it("uses the server's message for other JSON errors and allows a retry", () => {
    const error = new Error(JSON.stringify({ error: "server_error", message: "Something went wrong on my end." }));
    expect(describeChatError(error)).toEqual({ message: "Something went wrong on my end.", retryable: true });
  });

  it("explains network failures", () => {
    expect(describeChatError(new TypeError("Failed to fetch"))).toEqual({
      message: "Couldn't reach the server. Check your connection and try again.",
      retryable: true,
    });
  });

  it("passes through the friendly message from a stream error chunk", () => {
    const error = new Error("Sorry, I'm having trouble answering right now. Please try again in a moment.");
    expect(describeChatError(error).message).toMatch(/trouble answering/);
  });

  it("never shows a long or empty raw error message", () => {
    expect(describeChatError(new Error("x".repeat(500))).message).toBe("Something went wrong. Please try again.");
    expect(describeChatError(new Error("")).message).toBe("Something went wrong. Please try again.");
  });
});
