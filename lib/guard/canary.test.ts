import { describe, expect, it } from "vitest";
import { createCanary, createCanaryScanner } from "./canary";

const CANARY = "CANARY-1234abcd";

function run(chunks: string[]) {
  const scanner = createCanaryScanner(CANARY);
  let emitted = "";
  let leaked = false;
  for (const chunk of chunks) {
    const result = scanner.push(chunk);
    emitted += result.safe;
    leaked ||= result.leaked;
  }
  if (!leaked) emitted += scanner.flush();
  return { emitted, leaked };
}

describe("createCanary", () => {
  it("is unique and recognizable", () => {
    const a = createCanary();
    expect(a).toMatch(/^CANARY-[a-f0-9]{16}$/);
    expect(a).not.toBe(createCanary());
  });
});

describe("createCanaryScanner", () => {
  it("passes ordinary text through unchanged", () => {
    expect(run(["Hello ", "there, ", "I led billing v2."])).toEqual({
      emitted: "Hello there, I led billing v2.",
      leaked: false,
    });
  });

  it("detects the canary in a single chunk and emits only the text before it", () => {
    expect(run([`Sure! My marker is ${CANARY} ok`])).toEqual({
      emitted: "Sure! My marker is ",
      leaked: true,
    });
  });

  it("detects the canary split across chunks without emitting any part of it", () => {
    const result = run(["Here: CAN", "ARY-12", "34ab", "cd and more"]);
    expect(result).toEqual({ emitted: "Here: ", leaked: true });
  });

  it("holds back a possible prefix, then releases it once disproven", () => {
    const scanner = createCanaryScanner(CANARY);
    expect(scanner.push("I love CAN").safe).toBe("I love ");
    expect(scanner.push("DY").safe).toBe("CANDY");
    expect(scanner.flush()).toBe("");
  });

  it("flushes a trailing partial prefix at the end of the stream", () => {
    expect(run(["The end. CANA"])).toEqual({ emitted: "The end. CANA", leaked: false });
  });

  it("stays tripped after a leak", () => {
    const scanner = createCanaryScanner(CANARY);
    scanner.push(CANARY);
    expect(scanner.push("more text")).toEqual({ safe: "", leaked: true });
    expect(scanner.flush()).toBe("");
  });
});
