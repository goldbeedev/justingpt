import { z } from "zod";
import { CATEGORIES } from "@/lib/data/schemas";
import type { PipelineEvent, PipelinePath, TokenUsage } from "@/lib/pipeline";
import { INJECTION_RISKS, INTENTS } from "@/lib/prompts/classification";

// Part 1 suites test prompts + pipeline and don't depend on real resume content.
export const SUITES = ["routing", "security", "scope"] as const;
export type Suite = (typeof SUITES)[number];

const PATHS = ["answered", "refused", "declined", "rejected"] as const satisfies readonly PipelinePath[];

export const evalCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Expected lowercase kebab-case"),
  suite: z.enum(SUITES),
  message: z.string(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
  notes: z.string().optional(),
  expect: z
    .strictObject({
      path: z.array(z.enum(PATHS)).min(1).optional(),
      intent: z.array(z.enum(INTENTS)).min(1).optional(),
      categoriesInclude: z.array(z.enum(CATEGORIES)).optional(),
      categoriesExclude: z.array(z.enum(CATEGORIES)).optional(),
      risk: z.array(z.enum(INJECTION_RISKS)).min(1).optional(),
      storyTagsAny: z.array(z.string()).min(1).optional(),
      mustNotContain: z.array(z.string()).min(1).optional(),
      maxWords: z.int().positive().optional(),
    })
    .default({}),
});
export type EvalCase = z.output<typeof evalCaseSchema>;

export type MetaEvent = Extract<PipelineEvent, { type: "meta" }>;
export type FinishEvent = Extract<PipelineEvent, { type: "finish" }>;

/** Everything one pipeline run produced, as graders see it. */
export interface CaseRun {
  text: string;
  meta: MetaEvent;
  finish: FinishEvent;
}

export interface Grade {
  grader: string;
  pass: boolean;
  detail?: string;
}

export interface CaseResult {
  id: string;
  suite: Suite;
  attempt: number;
  message: string;
  pass: boolean;
  grades: Grade[];
  path: PipelinePath | null;
  intent: string | null;
  text: string;
  timings: Partial<FinishEvent["timings"]> & { totalMs: number };
  usage: { classifier?: TokenUsage; answer?: TokenUsage };
}
