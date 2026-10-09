import type { CaseResult } from "./types";

export interface Rate {
  total: number;
  passed: number;
  passRate: number;
}

export interface Summary {
  overall: Rate;
  suites: Record<string, Rate>;
  graders: Record<string, Rate>;
  failures: { id: string; suite: string; attempt: number; failed: string[] }[];
  medianTotalMs: number;
  tokens: { input: number; cachedInput: number; output: number };
}

const rate = (passed: number, total: number): Rate => ({ total, passed, passRate: total ? passed / total : 0 });

function tally(entries: [key: string, pass: boolean][]): Record<string, Rate> {
  const counts: Record<string, { passed: number; total: number }> = {};
  for (const [key, pass] of entries) {
    counts[key] ??= { passed: 0, total: 0 };
    counts[key].total += 1;
    if (pass) counts[key].passed += 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([k, c]) => [k, rate(c.passed, c.total)]));
}

export function summarize(results: CaseResult[]): Summary {
  const sorted = results.map((r) => r.timings.totalMs).sort((a, b) => a - b);
  const tokens = { input: 0, cachedInput: 0, output: 0 };
  for (const r of results) {
    for (const usage of [r.usage.classifier, r.usage.answer]) {
      tokens.input += usage?.inputTokens ?? 0;
      tokens.cachedInput += usage?.cachedInputTokens ?? 0;
      tokens.output += usage?.outputTokens ?? 0;
    }
  }

  return {
    overall: rate(results.filter((r) => r.pass).length, results.length),
    suites: tally(results.map((r) => [r.suite, r.pass])),
    graders: tally(results.flatMap((r) => r.grades.map((g) => [g.grader, g.pass] as [string, boolean]))),
    failures: results
      .filter((r) => !r.pass)
      .map((r) => ({
        id: r.id,
        suite: r.suite,
        attempt: r.attempt,
        failed: r.grades.filter((g) => !g.pass).map((g) => g.grader),
      })),
    medianTotalMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    tokens,
  };
}
