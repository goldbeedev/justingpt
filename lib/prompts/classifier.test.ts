import { describe, expect, it } from "vitest";
import { classifierV1 } from "./classifier.v1";
import { classifierV2 } from "./classifier.v2";
import { classificationSchema, INTENTS } from "./classification";
import { CATEGORIES } from "@/lib/data/schemas";

const nonce = "testnonce1234567";
const storyTags = ["conflict", "failure", "leadership"];

describe.each([classifierV1, classifierV2])("classifier prompt $version", (prompt) => {
const build = (history: { role: "user" | "assistant"; content: string }[] = []) =>
  prompt.build({ message: "Tell me about a time you failed", history, nonce, availableStoryTags: storyTags });
const classifierV1 = prompt; // shared tests below were written against v1

  it("exports an id and version", () => {
    expect(prompt.id).toBe("classifier");
    expect(prompt.version).toMatch(/^v\d+$/);
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

  it("delimits few-shot inputs in the same format as real inputs", () => {
    const firstShot = build().messages[0].content as string;
    expect(firstShot).toMatch(/^<user_message id="[a-f0-9]{16}">\n/);
  });

  it("keeps system + few-shots byte-identical across requests so the prefix can be cached", () => {
    const a = classifierV1.build({ message: "one", history: [], nonce: "aaaaaaaaaaaaaaaa", availableStoryTags: storyTags });
    const b = classifierV1.build({ message: "two", history: [], nonce: "bbbbbbbbbbbbbbbb", availableStoryTags: storyTags });
    expect(a.system).toBe(b.system);
    expect(a.messages.slice(0, -1)).toEqual(b.messages.slice(0, -1));
    expect(a.messages.at(-1)).not.toEqual(b.messages.at(-1));
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

describe("classifier prompt v2 specifics", () => {
  const build = (availableStoryTags: string[] = storyTags) =>
    classifierV2.build({ message: "hi", history: [], nonce, availableStoryTags });
  const shots = () => {
    const m = build().messages.slice(0, -1);
    return Array.from({ length: m.length / 2 }, (_, i) => ({
      input: m[2 * i].content as string,
      answer: classificationSchema.parse(JSON.parse(m[2 * i + 1].content as string)),
    }));
  };

  it("lists the story tags that actually exist in the data", () => {
    const { system } = build(["conflict", "zebra-tag"]);
    expect(system).toContain("zebra-tag");
    expect(system).toContain("conflict");
  });

  it("only uses story tags from the provided list in its few-shots", () => {
    for (const { answer } of shots()) {
      for (const tag of answer.storyTags) expect(storyTags).toContain(tag);
    }
  });

  it("teaches that questions *about* prompt design are legitimate (risk none)", () => {
    const shot = shots().find((s) => /system prompt/i.test(s.input) && /JustinGPT/.test(s.input));
    expect(shot?.answer).toMatchObject({ intent: "projects", injectionRisk: "none" });
  });

  it("includes a follow-up example that resolves a reference from history", () => {
    const shot = shots().find((s) => s.input.includes("<conversation_history"));
    expect(shot).toBeDefined();
    expect(shot!.input.indexOf("<conversation_history")).toBeLessThan(shot!.input.indexOf("<user_message"));
  });

  it("covers writing-for-the-visitor requests as off_topic", () => {
    expect(shots().some((s) => /cover letter/i.test(s.input) && s.answer.intent === "off_topic")).toBe(true);
  });
});
