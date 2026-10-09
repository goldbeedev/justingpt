import { describe, expect, it } from "vitest";
import * as route from "./route";

describe("app/api/chat/route", () => {
  it("exports only Next.js route exports: POST and maxDuration", () => {
    expect(Object.keys(route).sort()).toEqual(["POST", "maxDuration"]);
    expect(typeof route.POST).toBe("function");
    expect(route.maxDuration).toBeGreaterThan(0);
  });
});
