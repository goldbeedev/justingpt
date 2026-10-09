import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter, createRateLimiter, getClientIp } from "./ratelimit";

describe("createMemoryRateLimiter", () => {
  const setup = (limit = 3, windowMs = 1000) => {
    let now = 0;
    const limiter = createMemoryRateLimiter({ limit, windowMs, now: () => now });
    return { limiter, advance: (ms: number) => (now += ms) };
  };

  it("allows N requests in the window and blocks N+1", async () => {
    const { limiter } = setup(3);
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await limiter.limit("ip-1")).success);
    expect(results).toEqual([true, true, true, false]);
  });

  it("reports remaining requests and the reset time", async () => {
    const { limiter } = setup(3, 1000);
    expect(await limiter.limit("ip-1")).toEqual({ success: true, remaining: 2, reset: 1000 });
  });

  it("tracks keys independently", async () => {
    const { limiter } = setup(1);
    expect((await limiter.limit("ip-1")).success).toBe(true);
    expect((await limiter.limit("ip-2")).success).toBe(true);
    expect((await limiter.limit("ip-1")).success).toBe(false);
  });

  it("allows requests again after the window resets", async () => {
    const { limiter, advance } = setup(1, 1000);
    await limiter.limit("ip-1");
    expect((await limiter.limit("ip-1")).success).toBe(false);
    advance(1000);
    expect((await limiter.limit("ip-1")).success).toBe(true);
  });
});

describe("getClientIp", () => {
  const ip = (headers: Record<string, string>) => getClientIp(new Headers(headers));

  it("uses the first x-forwarded-for entry", () => {
    expect(ip({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" })).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(ip({ "x-real-ip": "198.51.100.2" })).toBe("198.51.100.2");
  });

  it("falls back to a shared bucket when no IP is present", () => {
    expect(ip({})).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  it("uses the in-memory limiter when Upstash is not configured", () => {
    expect(createRateLimiter({}).kind).toBe("memory");
  });

  it("uses Upstash when its env vars are present", () => {
    const env = { UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" };
    expect(createRateLimiter(env).kind).toBe("upstash");
  });

  it("accepts the Vercel Marketplace KV_* variable names too", () => {
    const env = { KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "t" };
    expect(createRateLimiter(env).kind).toBe("upstash");
  });
});
