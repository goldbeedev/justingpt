import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import type { ResumeData } from "@/lib/data/schemas";
import type { Models } from "@/lib/models";
import { runPipeline } from "@/lib/pipeline";
import type { ChatTurn } from "@/lib/prompts/types";
import { getClientIp, type RateLimiter } from "@/lib/ratelimit";
import type { ChatUIMessage, UnderTheHood } from "./types";

export const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 100;
const STREAM_ERROR_MESSAGE = "Sorry, I'm having trouble answering right now. Please try again in a moment.";

export interface ChatHandlerDeps {
  /** Called per request so a config error becomes a 500 instead of crashing the module. */
  getModels: () => Models;
  rateLimiter: RateLimiter;
  data: ResumeData;
  logger: Pick<Console, "error" | "warn">;
}

// Only what we need from the AI SDK's chat request; everything else is ignored.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        parts: z.array(z.looseObject({ type: z.string() })),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});
type BodyMessage = z.infer<typeof bodySchema>["messages"][number];

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers });

function withoutType<T extends { type: string }>({ type, ...rest }: T): Omit<T, "type"> {
  void type;
  return rest;
}

/** Visitors only ever contribute text; data parts echoed back by the client are dropped. */
function textOf(message: BodyMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" && typeof part.text === "string" ? [part.text] : []))
    .join("");
}

export function createChatHandler(deps: ChatHandlerDeps) {
  const { rateLimiter, data, logger } = deps;

  return async function POST(request: Request): Promise<Response> {
    try {
      const { success, reset } = await rateLimiter.limit(getClientIp(request.headers));
      if (!success) {
        const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return json(
          429,
          { error: "rate_limited", message: "You're sending messages quickly. Try again in a few minutes." },
          { "Retry-After": String(retryAfter) },
        );
      }
    } catch (error) {
      // Fail open: a limiter outage shouldn't take the site down with it.
      logger.error("Rate limiter failed; allowing request", error);
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return json(413, { error: "payload_too_large" });
    }

    let parsed: z.infer<typeof bodySchema>;
    try {
      parsed = bodySchema.parse(JSON.parse(raw));
    } catch {
      return json(400, { error: "bad_request" });
    }

    const last = parsed.messages.at(-1)!;
    if (last.role !== "user") return json(400, { error: "bad_request" });

    // System messages from the client are never trusted; our system prompt is built server-side.
    const history: ChatTurn[] = parsed.messages
      .slice(0, -1)
      .filter((m): m is BodyMessage & { role: ChatTurn["role"] } => m.role !== "system")
      .map((m) => ({ role: m.role, content: textOf(m) }));

    let models: Models;
    try {
      models = deps.getModels();
    } catch (error) {
      logger.error("Model configuration error", error);
      return json(500, { error: "server_error", message: "Something went wrong on my end." });
    }

    const stream = createUIMessageStream<ChatUIMessage>({
      execute: async ({ writer }) => {
        const partId = "under-the-hood";
        const textId = "answer";
        let meta: UnderTheHood | undefined;
        let textStarted = false;

        writer.write({ type: "start" });
        for await (const event of runPipeline({
          message: textOf(last),
          history,
          models,
          data,
          abortSignal: request.signal,
        })) {
          if (event.type === "meta") {
            meta = withoutType(event);
            writer.write({ type: "data-under-the-hood", id: partId, data: meta });
          } else if (event.type === "text") {
            if (!textStarted) writer.write({ type: "text-start", id: textId });
            textStarted = true;
            writer.write({ type: "text-delta", id: textId, delta: event.delta });
          } else {
            if (textStarted) writer.write({ type: "text-end", id: textId });
            const finish = withoutType(event);
            // Same id as the meta part, so the client updates it in place.
            if (meta) writer.write({ type: "data-under-the-hood", id: partId, data: { ...meta, finish } });
          }
        }
        writer.write({ type: "finish" });
      },
      onError: (error) => {
        logger.error("Chat stream failed", error);
        return STREAM_ERROR_MESSAGE;
      },
    });

    return createUIMessageStreamResponse({ stream });
  };
}
