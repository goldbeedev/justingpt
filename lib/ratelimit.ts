import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT = { limit: 20, windowMs: 10 * 60 * 1000 };

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Unix ms when the window resets. */
  reset: number;
}

export interface RateLimiter {
  kind: "memory" | "upstash";
  limit(key: string): Promise<RateLimitResult>;
}

interface MemoryOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/**
 * Fixed-window limiter for local dev and tests. On Vercel each instance has its own memory,
 * so production should use Upstash.
 */
export function createMemoryRateLimiter({ limit, windowMs, now = Date.now }: MemoryOptions): RateLimiter {
  const windows = new Map<string, { count: number; reset: number }>();

  return {
    kind: "memory",
    async limit(key) {
      const time = now();
      let entry = windows.get(key);
      if (!entry || time >= entry.reset) {
        entry = { count: 0, reset: time + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      return {
        success: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        reset: entry.reset,
      };
    },
  };
}

type Env = Record<string, string | undefined>;

export function createRateLimiter(env: Env = process.env, options = RATE_LIMIT): RateLimiter {
  // Upstash via the Vercel Marketplace may expose either naming scheme.
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;

  if (!url || !token) return createMemoryRateLimiter(options);

  const ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
    prefix: "justingpt:ratelimit",
  });
  return {
    kind: "upstash",
    async limit(key) {
      const { success, remaining, reset } = await ratelimit.limit(key);
      return { success, remaining, reset };
    },
  };
}

/** Vercel sets x-forwarded-for itself, so its first entry is the real client. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
