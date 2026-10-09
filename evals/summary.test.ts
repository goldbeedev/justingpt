import { describe, expect, it } from "vitest";
import { summarize } from "./summary";
import type { CaseResult } from "./types";

const result = (id: string, suite: CaseResult["suite"], pass: boolean, totalMs = 100): CaseResult => ({
  id,
  suite,
  attempt: 1,
  message: "m",
  pass,
  grades: [
    { grader: "path", pass: true },
    { grader: "intent", pass },
  ],
  path: "answered",
  intent: "skills",
  text: "t",
  timings: { totalMs },
  usage: { classifier: { inputTokens: 10, cachedInputTokens: 5, outputTokens: 2 } },
});

describe("summarize", () => {
  const results = [
    result("a", "routing", true, 100),
    result("b", "routing", false, 300),
    result("c", "security", true, 200),
  ];
  const summary = summarize(results);

  it("computes pass rates overall and per suite", () => {
    expect(summary.overall).toEqual({ total: 3, passed: 2, passRate: 2 / 3 });
    expect(summary.suites.routing).toEqual({ total: 2, passed: 1, passRate: 0.5 });
    expect(summary.suites.security).toEqual({ total: 1, passed: 1, passRate: 1 });
  });

  it("computes per-grader pass rates over the cases each grader applied to", () => {
    expect(summary.graders.intent).toEqual({ total: 3, passed: 2, passRate: 2 / 3 });
    expect(summary.graders.path).toEqual({ total: 3, passed: 3, passRate: 1 });
  });

  it("lists failures with the failing graders", () => {
    expect(summary.failures).toEqual([{ id: "b", suite: "routing", attempt: 1, failed: ["intent"] }]);
  });

  it("reports median latency and token totals", () => {
    expect(summary.medianTotalMs).toBe(200);
    expect(summary.tokens).toEqual({ input: 30, cachedInput: 15, output: 6 });
  });
});
