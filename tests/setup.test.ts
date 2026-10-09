import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

// Smoke test for the test harness itself: path alias resolution and AI SDK mocks.
describe("test harness", () => {
  it("can construct an AI SDK mock model", () => {
    const model = new MockLanguageModelV4();
    expect(model.specificationVersion).toBe("v4");
  });
});
