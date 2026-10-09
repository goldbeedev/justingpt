import { describe, expect, it } from "vitest";
import { matchStories, selectContext } from "./select";
import { fixtureResume } from "./__fixtures__/resume";

const ids = (stories: { id: string }[]) => stories.map((s) => s.id);

describe("selectContext", () => {
  it("returns only the requested categories (plus profile)", () => {
    const ctx = selectContext(fixtureResume, { categories: ["projects", "skills"] });
    expect(Object.keys(ctx).sort()).toEqual(["profile", "projects", "skills"]);
    expect(ctx.projects).toEqual(fixtureResume.projects);
  });

  it("always includes profile so the model knows who it is", () => {
    expect(Object.keys(selectContext(fixtureResume, { categories: [] }))).toEqual(["profile"]);
  });

  it("tolerates duplicate categories", () => {
    const ctx = selectContext(fixtureResume, { categories: ["faq", "faq"] });
    expect(Object.keys(ctx).sort()).toEqual(["faq", "profile"]);
  });

  it("narrows stories to the best tag matches when story tags are given", () => {
    const ctx = selectContext(fixtureResume, {
      categories: ["stories"],
      storyTags: ["failure"],
    });
    expect(ids(ctx.stories!)).toEqual(["s-failure"]);
  });

  it("caps stories at maxStories when no tags are given", () => {
    const ctx = selectContext(fixtureResume, { categories: ["stories"], maxStories: 2 });
    expect(ids(ctx.stories!)).toEqual(["s-conflict", "s-lead-conflict"]);
  });

  it("does not mutate the source data", () => {
    const before = structuredClone(fixtureResume);
    selectContext(fixtureResume, { categories: ["stories"], storyTags: ["conflict"] });
    expect(fixtureResume).toEqual(before);
  });
});

describe("matchStories", () => {
  const { stories } = fixtureResume;

  it("ranks by tag overlap, highest first", () => {
    expect(ids(matchStories(stories, ["leadership", "conflict"]))[0]).toBe("s-lead-conflict");
  });

  it("breaks ties by original order", () => {
    expect(ids(matchStories(stories, ["leadership", "conflict"], 3))).toEqual([
      "s-lead-conflict",
      "s-conflict",
      "s-lead",
    ]);
  });

  it("excludes stories with zero overlap", () => {
    expect(ids(matchStories(stories, ["mentoring"]))).toEqual(["s-lead"]);
    expect(matchStories(stories, ["unrelated"])).toEqual([]);
  });

  it("caps results at the limit", () => {
    expect(matchStories(stories, ["leadership", "conflict"], 1)).toHaveLength(1);
  });

  it("matches query tags case-insensitively", () => {
    expect(ids(matchStories(stories, ["FAILURE"]))).toEqual(["s-failure"]);
  });
});
