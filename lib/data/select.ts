import type { Category, ResumeData } from "./schemas";

type Story = ResumeData["stories"][number];

export type ResumeContext = Pick<ResumeData, "profile"> & Partial<ResumeData>;

export interface SelectOptions {
  categories: readonly Category[];
  storyTags?: readonly string[];
  maxStories?: number;
}

const DEFAULT_MAX_STORIES = 2;

/**
 * Least-context selection: only the categories the classifier asked for reach the prompt.
 * Profile is always included so the model knows whose resume it is answering from.
 */
export function selectContext(data: ResumeData, options: SelectOptions): ResumeContext {
  const { categories, storyTags = [], maxStories = DEFAULT_MAX_STORIES } = options;
  const context: ResumeContext = { profile: data.profile };

  for (const category of new Set(categories)) {
    if (category === "stories") {
      context.stories =
        storyTags.length > 0
          ? matchStories(data.stories, storyTags, maxStories)
          : data.stories.slice(0, maxStories);
    } else {
      Object.assign(context, { [category]: data[category] });
    }
  }
  return context;
}

/** Ranks stories by tag overlap (ties keep file order) and drops stories with no overlap. */
export function matchStories(
  stories: readonly Story[],
  tags: readonly string[],
  limit = DEFAULT_MAX_STORIES,
): Story[] {
  const wanted = new Set(tags.map((t) => t.toLowerCase()));
  return stories
    .map((story, index) => ({
      story,
      index,
      score: story.tags.filter((t) => wanted.has(t)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.story);
}
