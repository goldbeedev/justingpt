import { createChatHandler } from "@/lib/chat/handler";
import { loadResumeData } from "@/lib/data/load";
import { getModels } from "@/lib/models";
import { createRateLimiter } from "@/lib/ratelimit";

export const maxDuration = 30;

const rateLimiter = createRateLimiter();
if (rateLimiter.kind === "memory" && process.env.VERCEL_ENV === "production") {
  console.warn("Upstash is not configured; falling back to a per-instance in-memory rate limiter.");
}

export const POST = createChatHandler({
  getModels: () => getModels(),
  rateLimiter,
  data: loadResumeData(),
  logger: console,
});
