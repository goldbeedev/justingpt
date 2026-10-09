import { describe, expect, it } from "vitest";
import { answerV1 } from "./answer.v1";
import { answerV2 } from "./answer.v2";
import { selectContext } from "@/lib/data/select";
import { fixtureResume } from "@/lib/data/__fixtures__/resume";

const nonce = "testnonce1234567";
const canary = "CANARY-abc";
type Input = Parameters<typeof answerV1.build>[0];

// Every version must keep these structural guarantees; wording is judged by evals.
describe.each([answerV1, answerV2])("answer prompt $version", (prompt) => {
const build = (overrides: Partial<Input> = {}) =>
  prompt.build({
    context: selectContext(fixtureResume, { categories: ["projects"] }),
    voice: fixtureResume.personal.voice,
    intent: "projects",
    message: "What did you build at Acme?",
    history: [],
    nonce,
    canary,
    ...overrides,
  });

  it("exports an id and version", () => {
    expect(prompt.id).toBe("answer");
    expect(prompt.version).toMatch(/^v\d+$/);
  });

  it("orders system sections ROLE → RULES → STYLE → OUTPUT FORMAT → CONTEXT", () => {
    const { system } = build();
    const positions = ["# ROLE", "# RULES", "# STYLE", "# OUTPUT FORMAT", "# CONTEXT"].map((h) =>
      system.indexOf(h),
    );
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("instructs the model to speak in first person", () => {
    expect(build().system).toMatch(/first person/i);
  });

  it("includes only the selected data slices, each delimited", () => {
    const { system } = build();
    expect(system).toContain(`<resume_data id="${nonce}" category="profile">`);
    expect(system).toContain(`<resume_data id="${nonce}" category="projects">`);
    expect(system).not.toContain('category="experience"');
    expect(system).toContain("Billing v2");
    expect(system).not.toContain("Shipped billing v2"); // experience highlight
  });

  it("never puts user text in the system prompt", () => {
    const { system } = build({ message: "UNIQUE-USER-TEXT" });
    expect(system).not.toContain("UNIQUE-USER-TEXT");
  });

  it("delimits the user message and places the sandwich reminder after it", () => {
    const { messages } = build();
    const last = messages.at(-1)!;
    expect(last.role).toBe("user");
    const content = last.content as string;
    const close = content.indexOf(`</user_message id="${nonce}">`);
    expect(content.indexOf(`<user_message id="${nonce}">`)).toBe(0);
    expect(close).toBeGreaterThan(0);
    expect(content.slice(close)).toMatch(/reminder/i);
  });

  it("delimits prior user turns and passes assistant turns through", () => {
    const { messages } = build({
      history: [
        { role: "user", content: "earlier question" },
        { role: "assistant", content: "earlier answer" },
      ],
    });
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[0].content).toContain(`<user_message id="${nonce}">`);
    expect(messages[1].content).toBe("earlier answer");
  });

  it("asks for STAR structure only for behavioral questions", () => {
    expect(build({ intent: "behavioral" }).system).toMatch(/STAR/);
    expect(build({ intent: "projects" }).system).not.toMatch(/STAR/);
  });

  it("embeds the canary in the system prompt", () => {
    expect(build().system).toContain(canary);
  });

  it("includes the voice sample as a style reference", () => {
    expect(build().system).toContain(fixtureResume.personal.voice.sample);
  });
});
