import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./schemas";
import { loadResumeData, parseResumeData, rawResumeFiles, ResumeDataError } from "./load";
import { fixtureResume } from "./__fixtures__/resume";

const clone = <T>(v: T): T => structuredClone(v);

function expectInvalid(mutate: (raw: Record<string, unknown>) => void, ...fragments: string[]) {
  const raw = clone(fixtureResume) as unknown as Record<string, unknown>;
  mutate(raw);
  let error: unknown;
  try {
    parseResumeData(raw);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ResumeDataError);
  for (const fragment of fragments) expect((error as Error).message).toContain(fragment);
}

describe("real data files", () => {
  it("every data/*.json file passes its schema", () => {
    expect(() => loadResumeData()).not.toThrow();
  });

  it("has a file for every category", () => {
    expect(Object.keys(rawResumeFiles).sort()).toEqual([...CATEGORIES].sort());
  });
});

describe("parseResumeData", () => {
  it("accepts a valid dataset", () => {
    expect(parseResumeData(clone(fixtureResume))).toEqual(fixtureResume);
  });

  it("names the file and the path of a missing field", () => {
    expectInvalid((raw) => {
      delete (raw.stories as Record<string, unknown>[])[0].tags;
    }, "stories.json", "tags");
  });

  it("reports errors from every invalid file, not just the first", () => {
    expectInvalid(
      (raw) => {
        delete (raw.profile as Record<string, unknown>).name;
        delete (raw.projects as Record<string, unknown>[])[0].outcome;
      },
      "profile.json",
      "projects.json",
    );
  });

  it("rejects experience that ends before it starts", () => {
    expectInvalid((raw) => {
      Object.assign((raw.experience as object[])[0], { start: "2022-01", end: "2021-06" });
    }, "experience.json", "end");
  });

  it("rejects malformed YYYY-MM dates", () => {
    expectInvalid((raw) => {
      Object.assign((raw.experience as object[])[0], { start: "March 2021" });
    }, "experience.json", "start");
  });

  it("rejects duplicate story ids", () => {
    expectInvalid((raw) => {
      const stories = raw.stories as { id: string }[];
      stories[1].id = stories[0].id;
    }, "stories.json", "Duplicate");
  });

  it("requires lowercase kebab-case story tags so matching is predictable", () => {
    expectInvalid((raw) => {
      (raw.stories as { tags: string[] }[])[0].tags = ["Conflict Resolution"];
    }, "stories.json", "tags");
  });

  it("accepts optional education entries on the profile", () => {
    const raw = clone(fixtureResume);
    raw.profile.education = [{ school: "State University", credential: "B.A. Communications" }];
    expect(parseResumeData(raw).profile.education).toHaveLength(1);
  });

  it("rejects education entries missing a credential", () => {
    expectInvalid((raw) => {
      (raw.profile as Record<string, unknown>).education = [{ school: "State University" }];
    }, "profile.json", "credential");
  });

  it("rejects non-http(s) links (rendered as Markdown, so no javascript: URLs)", () => {
    expectInvalid((raw) => {
      (raw.profile as { links: { url: string }[] }).links[0].url = "javascript:alert(1)";
    }, "profile.json", "url");
  });
});
