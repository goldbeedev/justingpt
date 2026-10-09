import { z } from "zod";

export const CATEGORIES = [
  "profile",
  "experience",
  "skills",
  "projects",
  "stories",
  "personal",
  "faq",
] as const;
export type Category = (typeof CATEGORIES)[number];

const text = z.string().trim().min(1);
const textList = z.array(text);
// Links are rendered as Markdown, so only allow http(s) to rule out javascript: and friends.
const httpUrl = z.url({ protocol: /^https?$/ });
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");
const tag = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Expected lowercase kebab-case");

const link = z.object({ label: text, url: httpUrl });

export const profileSchema = z.object({
  name: text,
  title: text,
  yearsExperience: z.int().nonnegative(),
  location: text,
  summary: text,
  greeting: text,
  links: z.array(link),
  email: z.email().optional(),
  availability: text.optional(),
});

export const experienceSchema = z.array(
  z
    .object({
      company: text,
      role: text,
      start: yearMonth,
      end: z.union([yearMonth, z.literal("present")]),
      location: text.optional(),
      summary: text,
      stack: textList,
      highlights: textList,
      metrics: textList.optional(),
    })
    // YYYY-MM compares correctly as a string.
    .refine((job) => job.end === "present" || job.end >= job.start, {
      message: "end must not be before start",
      path: ["end"],
    }),
);

export const skillsSchema = z.object({
  groups: z.array(
    z.object({
      name: text,
      items: z.array(
        z.object({
          name: text,
          level: z.enum(["expert", "proficient", "familiar"]),
          years: z.number().nonnegative().optional(),
        }),
      ),
    }),
  ),
  favorites: textList,
  preferNot: textList.optional(),
});

export const projectsSchema = z.array(
  z.object({
    id: tag,
    name: text,
    summary: text,
    problem: text,
    role: text,
    stack: textList,
    architecture: textList.optional(),
    outcome: text,
    link: httpUrl.optional(),
  }),
);

export const storiesSchema = z
  .array(
    z.object({
      id: tag,
      title: text,
      tags: z.array(tag).min(1),
      questionPatterns: textList.min(1),
      situation: text,
      task: text,
      action: text,
      result: text,
      lesson: text.optional(),
    }),
  )
  .superRefine((stories, ctx) => {
    const seen = new Set<string>();
    stories.forEach((story, i) => {
      if (seen.has(story.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate story id "${story.id}"`, path: [i, "id"] });
      }
      seen.add(story.id);
    });
  });

export const personalSchema = z.object({
  bio: text.optional(),
  hobbies: z.array(z.object({ name: text, detail: text })),
  interests: textList,
  funFacts: textList,
  values: textList,
  workingStyle: textList,
  voice: z.object({ tone: text, sample: text }),
});

// Generic fixed-reply routing: add a topic here to give it a canned, reviewed answer.
export const faqSchema = z.array(
  z.object({ id: tag, topic: text, triggers: textList.min(1), answer: text }),
);

export const categorySchemas = {
  profile: profileSchema,
  experience: experienceSchema,
  skills: skillsSchema,
  projects: projectsSchema,
  stories: storiesSchema,
  personal: personalSchema,
  faq: faqSchema,
} satisfies Record<Category, z.ZodType>;

export type ResumeData = { [C in Category]: z.infer<(typeof categorySchemas)[C]> };
