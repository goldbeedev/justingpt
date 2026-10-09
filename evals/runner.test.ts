import { describe, expect, it } from "vitest";
import { runCases } from "./runner";
import type { EvalCase } from "./types";
import { classification, failingModel, mockAnswer, mockClassifier } from "@/lib/test/mock-models";
import { fixtureResume } from "@/lib/data/__fixtures__/resume";

const evalCase = (id: string, expect: EvalCase["expect"]): EvalCase => ({
  id,
  suite: "routing",
  message: "What did you build?",
  history: [],
  expect,
});

describe("runCases", () => {
  const models = () => ({
    classifier: mockClassifier(classification()),
    answer: mockAnswer(["I built ", "Billing v2."]),
  });

  it("runs each case through the real pipeline and grades it", async () => {
    const [result] = await runCases([evalCase("a", { path: ["answered"], intent: ["projects"] })], {
      models: models(),
      data: fixtureResume,
    });
    expect(result).toMatchObject({ id: "a", attempt: 1, pass: true, path: "answered", intent: "projects", text: "I built Billing v2." });
  });

  it("grades story tags against the tags that exist in the data", async () => {
    const [result] = await runCases([evalCase("tags", {})], {
      models: {
        classifier: mockClassifier(classification({ intent: "behavioral", categories: ["stories"], storyTags: ["made-up"] })),
        answer: mockAnswer(["I once failed."]),
      },
      data: fixtureResume,
    });
    expect(result.grades.find((g) => g.grader === "validTags")).toMatchObject({ pass: false });
  });

  it("repeats cases and numbers the attempts", async () => {
    const results = await runCases([evalCase("a", {})], { models: models(), data: fixtureResume, repeat: 3 });
    expect(results.map((r) => r.attempt)).toEqual([1, 2, 3]);
  });

  it("records a failing 'error' grade instead of aborting the whole run", async () => {
    const results = await runCases([evalCase("boom", {}), evalCase("ok", {})], {
      models: { classifier: failingModel("kaboom"), answer: mockAnswer(["x"]) },
      data: fixtureResume,
    });
    expect(results[0]).toMatchObject({ id: "boom", pass: false });
    expect(results[0].grades).toEqual([{ grader: "error", pass: false, detail: "kaboom" }]);
    expect(results).toHaveLength(2);
  });

  it("keeps results in case order regardless of concurrency", async () => {
    const cases = ["a", "b", "c", "d", "e"].map((id) => evalCase(id, {}));
    const results = await runCases(cases, { models: models(), data: fixtureResume, concurrency: 3 });
    expect(results.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
