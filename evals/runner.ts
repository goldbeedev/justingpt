import type { ResumeData } from "@/lib/data/schemas";
import type { Models } from "@/lib/models";
import { runPipeline } from "@/lib/pipeline";
import { gradeCase } from "./graders";
import type { CaseResult, CaseRun, EvalCase } from "./types";

export interface RunOptions {
  models: Models;
  data: ResumeData;
  repeat?: number;
  concurrency?: number;
  promptVersions?: { classifier?: string; answer?: string };
  onResult?: (result: CaseResult) => void;
}

async function collect(evalCase: EvalCase, options: RunOptions): Promise<CaseRun> {
  let text = "";
  let meta: CaseRun["meta"] | undefined;
  let finish: CaseRun["finish"] | undefined;
  for await (const event of runPipeline({
    message: evalCase.message,
    history: evalCase.history,
    models: options.models,
    data: options.data,
    promptVersions: options.promptVersions,
  })) {
    if (event.type === "meta") meta = event;
    else if (event.type === "text") text += event.delta;
    else finish = event;
  }
  if (!meta || !finish) throw new Error("pipeline ended without meta/finish events");
  return { text, meta, finish };
}

async function runOne(evalCase: EvalCase, attempt: number, options: RunOptions): Promise<CaseResult> {
  const base = { id: evalCase.id, suite: evalCase.suite, attempt, message: evalCase.message };
  try {
    const run = await collect(evalCase, options);
    return {
      ...base,
      ...gradeCase(evalCase, run),
      path: run.meta.path,
      intent: run.meta.classification?.intent ?? null,
      text: run.text,
      timings: run.finish.timings,
      usage: run.finish.usage,
    };
  } catch (error) {
    // One broken case (rate limit, provider hiccup) shouldn't abort the whole run.
    return {
      ...base,
      pass: false,
      grades: [{ grader: "error", pass: false, detail: (error as Error).message }],
      path: null,
      intent: null,
      text: "",
      timings: { totalMs: 0 },
      usage: {},
    };
  }
}

/** Runs every case `repeat` times with bounded concurrency; results keep case order. */
export async function runCases(cases: EvalCase[], options: RunOptions): Promise<CaseResult[]> {
  const { repeat = 1, concurrency = 4 } = options;
  const jobs = cases.flatMap((c) => Array.from({ length: repeat }, (_, i) => ({ evalCase: c, attempt: i + 1 })));
  const results: CaseResult[] = new Array(jobs.length);
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const index = next++;
      const { evalCase, attempt } = jobs[index];
      results[index] = await runOne(evalCase, attempt, options);
      options.onResult?.(results[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}
