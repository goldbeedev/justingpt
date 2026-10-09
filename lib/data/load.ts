import { z } from "zod";
import { CATEGORIES, categorySchemas, type Category, type ResumeData } from "./schemas";
import profile from "@/data/profile.json";
import experience from "@/data/experience.json";
import skills from "@/data/skills.json";
import projects from "@/data/projects.json";
import stories from "@/data/stories.json";
import personal from "@/data/personal.json";
import faq from "@/data/faq.json";

// Static imports keep the data bundled with the serverless function (no fs reads on Vercel).
export const rawResumeFiles: Record<Category, unknown> = {
  profile,
  experience,
  skills,
  projects,
  stories,
  personal,
  faq,
};

export class ResumeDataError extends Error {
  name = "ResumeDataError";
}

/** Validates every category and reports all invalid files at once. */
export function parseResumeData(raw: Record<string, unknown>): ResumeData {
  const parsed: Partial<Record<Category, unknown>> = {};
  const errors: string[] = [];

  for (const category of CATEGORIES) {
    const result = categorySchemas[category].safeParse(raw[category]);
    if (result.success) parsed[category] = result.data;
    else errors.push(`data/${category}.json\n${z.prettifyError(result.error)}`);
  }

  if (errors.length > 0) {
    throw new ResumeDataError(`Invalid resume data:\n\n${errors.join("\n\n")}`);
  }
  return parsed as ResumeData;
}

let cached: ResumeData | undefined;

export function loadResumeData(): ResumeData {
  cached ??= parseResumeData(rawResumeFiles);
  return cached;
}
