import { describe, expect, it } from "vitest";
import { buildSuggestionPool, pickSuggestions } from "./suggestions";
import { fixtureResume } from "./__fixtures__/resume";
import { loadResumeData } from "./load";

// Deterministic stand-in for Math.random.
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe("buildSuggestionPool", () => {
  it("draws questions from the resume data", () => {
    const all = buildSuggestionPool(fixtureResume).flat();
    expect(all).toContain("What did you work on at Acme?");
    expect(all).toContain("Tell me about Billing v2");
    expect(all).toContain("How much experience do you have with TypeScript?");
  });

  it("dedupes story question patterns", () => {
    const pool = buildSuggestionPool(fixtureResume);
    for (const group of pool) expect(new Set(group).size).toBe(group.length);
  });

  it("only uses FAQ topics that are phrased as questions", () => {
    const faq = [
      { id: "a", topic: "Getting in touch", triggers: ["contact"], answer: "Email me." },
      { id: "b", topic: "Are you remote?", triggers: ["remote"], answer: "Yes." },
    ];
    const all = buildSuggestionPool({ ...fixtureResume, faq }).flat();
    expect(all).toContain("Are you remote?");
    expect(all).not.toContain("Getting in touch");
  });

  it("drops empty themes", () => {
    const pool = buildSuggestionPool({ ...fixtureResume, projects: [], faq: [] });
    expect(pool.every((group) => group.length > 0)).toBe(true);
  });

  it("builds a pool from the real data", () => {
    expect(buildSuggestionPool(loadResumeData()).length).toBeGreaterThanOrEqual(4);
  });
});

describe("pickSuggestions", () => {
  const pool = [
    ["a1", "a2", "a3"],
    ["b1", "b2"],
    ["c1"],
  ];
  const theme = (q: string) => q[0];

  it("covers every theme before repeating one", () => {
    const picks = pickSuggestions(pool, 3, seeded(1));
    expect(new Set(picks.map(theme)).size).toBe(3);
  });

  it("returns distinct questions and caps at the pool size", () => {
    const picks = pickSuggestions(pool, 10, seeded(2));
    expect(picks).toHaveLength(6);
    expect(new Set(picks).size).toBe(6);
  });

  it("varies with the random source", () => {
    const sets = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => pickSuggestions(pool, 3, seeded(seed)).join()),
    );
    expect(sets.size).toBeGreaterThan(1);
  });

  it("does not mutate the pool", () => {
    const before = structuredClone(pool);
    pickSuggestions(pool, 4, seeded(3));
    expect(pool).toEqual(before);
  });
});
