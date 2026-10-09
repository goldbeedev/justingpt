import { z } from "zod";
import { CATEGORIES } from "@/lib/data/schemas";

export const INTENTS = [
  "experience",
  "skills",
  "projects",
  "behavioral",
  "personal",
  "contact",
  "meta",
  "off_topic",
] as const;
export type Intent = (typeof INTENTS)[number];

export const INJECTION_RISKS = ["none", "low", "high"] as const;

// Every field is required (no optionals/defaults) so the schema works with strict structured outputs.
export const classificationSchema = z.object({
  intent: z.enum(INTENTS),
  categories: z.array(z.enum(CATEGORIES)),
  storyTags: z.array(z.string()),
  injectionRisk: z.enum(INJECTION_RISKS),
  needsClarification: z.boolean(),
  rationale: z.string(),
});
export type Classification = z.infer<typeof classificationSchema>;
