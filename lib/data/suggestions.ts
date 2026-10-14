import type { ResumeData } from "./schemas";

/** Candidate starter questions grouped by theme, so a random pick can stay varied. */
export type SuggestionPool = string[][];

/**
 * Builds starter questions from the resume data, so every suggestion is one the bot
 * has real material to answer. Empty themes are dropped.
 */
export function buildSuggestionPool(data: ResumeData): SuggestionPool {
  const { experience, projects, stories, skills, personal, faq } = data;

  const work = [
    ...experience.slice(0, 3).map((job) => `What did you work on at ${job.company}?`),
    "What kind of role are you looking for?",
  ];

  const builds = projects.flatMap((project) => [
    `Tell me about ${project.name}`,
    `How did you build ${project.name}?`,
  ]);

  // The first pattern is each story's canonical phrasing; several stories share one.
  const behavioral = [...new Set(stories.map((story) => story.questionPatterns[0]))];

  const tech = [
    ...skills.favorites.map((skill) => `How much experience do you have with ${skill}?`),
    "What's your favorite tech stack?",
  ];

  const life = [
    ...(personal.hobbies.length > 0 ? ["What do you do for fun?"] : []),
    ...(personal.funFacts.length > 0 ? ["Tell me a fun fact about yourself"] : []),
    ...(personal.values.length > 0 ? ["What do you value in a team?"] : []),
    ...(personal.workingStyle.length > 0 ? ["How do you like to work?"] : []),
  ];

  // FAQ topics double as suggestions only when they're already phrased as questions.
  const asked = faq.map((entry) => entry.topic).filter((topic) => topic.endsWith("?"));

  return [work, builds, behavioral, tech, life, asked].filter((group) => group.length > 0);
}

/**
 * Picks `count` distinct questions, at most one per theme until every theme has
 * contributed, so visitors see a different but well-rounded set each time.
 */
export function pickSuggestions(
  pool: SuggestionPool,
  count: number,
  random: () => number = Math.random,
): string[] {
  const queues = shuffle(pool.map((group) => shuffle(group, random)), random);
  const picks: string[] = [];
  while (picks.length < count && queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next !== undefined && !picks.includes(next)) picks.push(next);
      if (picks.length === count) break;
    }
  }
  return picks;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
