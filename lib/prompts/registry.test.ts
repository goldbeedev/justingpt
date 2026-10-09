import { describe, expect, it } from "vitest";
import { getPrompt } from "./registry";

describe("prompt registry", () => {
  it("defaults to v2, which beat v1 97.8% to 51.9% on the eval suite", () => {
    expect(getPrompt("classifier").version).toBe("v2");
    expect(getPrompt("answer").version).toBe("v2");
  });

  it("selects a version by override (for A/B testing in evals)", () => {
    expect(getPrompt("answer", "v1").version).toBe("v1");
    expect(getPrompt("answer", "v2").version).toBe("v2");
    expect(getPrompt("classifier", "v2").version).toBe("v2");
  });

  it("throws on an unknown version instead of silently falling back", () => {
    expect(() => getPrompt("answer", "v999")).toThrow(/v999/);
  });
});
