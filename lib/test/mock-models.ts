import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { Classification } from "@/lib/prompts/classification";

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: output, text: output, reasoning: undefined },
});

export function classification(overrides: Partial<Classification> = {}): Classification {
  return {
    intent: "projects",
    categories: ["projects"],
    storyTags: [],
    injectionRisk: "none",
    needsClarification: false,
    rationale: "test",
    ...overrides,
  };
}

/** A classifier model that returns `output` verbatim (an object is JSON-encoded). */
export function mockClassifier(output: Classification | string) {
  const text = typeof output === "string" ? output : JSON.stringify(output);
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: usage(100, 20),
      warnings: [],
    }),
  });
}

/** An answer model that streams the given text chunks. */
export function mockAnswer(chunks: string[]) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start" as const, id: "t1" },
          ...chunks.map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
          { type: "text-end" as const, id: "t1" },
          {
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: undefined },
            logprobs: undefined,
            usage: usage(500, 50),
          },
        ],
      }),
    }),
  });
}

/** A model whose every call fails, like a provider outage. */
export function failingModel(message = "provider down") {
  const fail = async () => {
    throw new Error(message);
  };
  return new MockLanguageModelV4({ doGenerate: fail, doStream: fail });
}

/** The system prompt + flattened message text a mock model was called with. */
export function promptText(call: { prompt: { role: string; content: unknown }[] }) {
  return call.prompt
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : (m.content as { type: string; text?: string }[]).map((p) => p.text ?? "").join(""),
    )
    .join("\n\n");
}
