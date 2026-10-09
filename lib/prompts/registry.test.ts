import { describe, expect, it } from "vitest";
import { getPrompt } from "./registry";

describe("prompt registry", () => {
  it("returns the default version of each prompt", () => {
    expect(getPrompt("classifier").version).toBe("v1");
    expect(getPrompt("answer").version).toBe("v1");
  });

  it("selects a version by override (for A/B testing in evals)", () => {
    expect(getPrompt("answer", "v1").id).toBe("answer");
  });

  it("throws on an unknown version instead of silently falling back", () => {
    expect(() => getPrompt("answer", "v999")).toThrow(/v999/);
  });
});
