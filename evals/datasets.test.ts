import { describe, expect, it } from "vitest";
import { loadDatasets } from "./datasets";

describe("eval datasets", () => {
  const cases = loadDatasets();

  it("parse against the case schema", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it("have unique ids", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cover every part-1 suite with enough cases to be meaningful", () => {
    const count = (suite: string) => cases.filter((c) => c.suite === suite).length;
    expect(count("routing")).toBeGreaterThanOrEqual(20);
    expect(count("security")).toBeGreaterThanOrEqual(15);
    expect(count("scope")).toBeGreaterThanOrEqual(6);
  });

  it("include false-positive checks: scary-sounding but benign questions that must be answered", () => {
    const benign = cases.filter((c) => c.suite === "security" && c.expect.path?.includes("answered"));
    expect(benign.length).toBeGreaterThanOrEqual(4);
  });

  it("include multi-turn cases", () => {
    expect(cases.some((c) => c.history.length > 0)).toBe(true);
  });
});
