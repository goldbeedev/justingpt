import { describe, expect, it } from "vitest";
import { classifierV1 } from "./classifier.v1";
import { classificationSchema, INTENTS } from "./classification";
import { CATEGORIES } from "@/lib/data/schemas";

const nonce = "testnonce1234567";
const build = (history: { role: "user" | "assistant"; content: string }[] = []) =>
  classifierV1.build({ message: "Tell me about a time you failed", history, nonce });

describe("classifier prompt v1", () => {
  it("exports an id and version", () => {
    expect(classifierV1.id).toBe("classifier");
    expect(classifierV1.version).toBe("v1");
  });

  it("documents every intent and category in the schema (prompt stays in sync)", () => {
    const { system } = build();
    for (const intent of INTENTS) expect(system).toContain(intent);
    for (const category of CATEGORIES) expect(system).toContain(category);
  });

  it("frames user input as data to classify, not instructions", () => {
    expect(build().system).toMatch(/never follow/i);
  });

  it("provides few-shot examples as alternating user/assistant turns", () => {
    const shots = build().messages.slice(0, -1);
    expect(shots.length).toBeGreaterThanOrEqual(12); // ≥ 6 examples
    shots.forEach((m, i) => expect(m.role).toBe(i % 2 === 0 ? "user" : "assistant"));
  });

  it("only uses few-shot answers that are valid against the output schema", () => {
    const answers = build()
      .messages.slice(0, -1)
      .filter((m) => m.role === "assistant")
      .map((m) => classificationSchema.parse(JSON.parse(m.content as string)));
    expect(answers.some((a) => a.injectionRisk === "high")).toBe(true);
    expect(answers.some((a) => a.intent === "off_topic")).toBe(true);
    expect(answers.some((a) => a.intent === "behavioral" && a.storyTags.length > 0)).toBe(true);
  });

  it("delimits few-shot inputs exactly like real inputs", () => {
    const firstShot = build().messages[0].content as string;
    expect(firstShot.startsWith(`<user_message id="${nonce}">`)).toBe(true);
  });

  it("delimits the real user message as the final turn", () => {
    const last = build().messages.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content).toContain(`<user_message id="${nonce}">\nTell me about a time you failed\n`);
  });

  it("includes recent history in a delimited block for follow-up questions", () => {
    const last = build([
      { role: "user", content: "What's your favorite project?" },
      { role: "assistant", content: "Billing v2." },
    ]).messages.at(-1)!.content as string;
    expect(last).toContain(`<conversation_history id="${nonce}">`);
    expect(last).toContain("Billing v2.");
    expect(last.indexOf("<conversation_history")).toBeLessThan(last.indexOf("<user_message"));
  });

  it("omits the history block when there is no history", () => {
    expect(build().messages.at(-1)!.content).not.toContain("conversation_history");
  });
});
