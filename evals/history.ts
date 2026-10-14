/**
 * Condenses saved eval runs into evals/history.json, the small public record the
 * /evals page renders. Full runs (hundreds of KB each) stay out of the app bundle.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Rate, Summary } from "./summary";
import type { CaseResult, EvalCase } from "./types";

export const EVALS_DIR = fileURLToPath(new URL("./", import.meta.url));
export const RESULTS_DIR = join(EVALS_DIR, "results");
export const HISTORY_FILE = join(EVALS_DIR, "history.json");
export const NOTES_FILE = join(EVALS_DIR, "notes.json");

export interface SavedRun {
  startedAt: string;
  label: string | null;
  git: { commit: string; dirty: boolean };
  models: { classifier?: string; answer?: string };
  promptVersions: { classifier: string; answer: string };
  filters: { suite: string[] | null; case: string[] | null; repeat: number };
  summary: Summary;
  results?: CaseResult[];
}

/** Hand-written context for a run, keyed by its --label. */
export type RunNotes = Record<string, { title: string; summary: string }>;

export interface HistoryRun {
  startedAt: string;
  label: string | null;
  title: string | null;
  summary: string | null;
  commit: string;
  promptVersions: { classifier: string; answer: string };
  models: { classifier: string | null; answer: string | null };
  repeat: number;
  overall: Rate;
  suites: Record<string, Rate>;
  medianTotalMs: number;
}

export interface HistoryCase {
  id: string;
  suite: string;
  message: string;
  expected: string;
  notes: string | null;
  passed: number;
  total: number;
}

export interface HistoryFailure {
  id: string;
  suite: string;
  attempt: number;
  message: string;
  reasons: string[];
  reply: string;
}

export interface EvalHistory {
  /** Full-suite runs only, oldest first; partial reruns aren't comparable. */
  runs: HistoryRun[];
  /** Per-case and per-grader results from the latest full run. */
  latest: {
    graders: Record<string, Rate>;
    cases: HistoryCase[];
    failures: HistoryFailure[];
  } | null;
}

const isFullRun = (run: SavedRun) => !run.filters.suite && !run.filters.case;

/** One line a non-engineer can read, e.g. "refused" or "answered · intent: projects or meta". */
export function describeExpect(expect: EvalCase["expect"]): string {
  const parts: string[] = [];
  if (expect.path) parts.push(expect.path.join(" or "));
  if (expect.intent) parts.push(`intent: ${expect.intent.join(" or ")}`);
  if (expect.categoriesInclude?.length) parts.push(`loads ${expect.categoriesInclude.join(", ")}`);
  if (expect.categoriesExclude?.length) parts.push(`never loads ${expect.categoriesExclude.join(", ")}`);
  if (expect.storyTagsAny) parts.push(`story: ${expect.storyTagsAny.join(" or ")}`);
  if (expect.mustNotContain) parts.push(`never says "${expect.mustNotContain.join('", "')}"`);
  if (expect.maxWords) parts.push(`≤ ${expect.maxWords} words`);
  return parts.join(" · ") || "safety checks only";
}

export function buildHistory(saved: SavedRun[], cases: EvalCase[], notes: RunNotes): EvalHistory {
  const full = saved.filter(isFullRun).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const byId = new Map(cases.map((c) => [c.id, c]));

  const runs = full.map((run): HistoryRun => {
    const note = run.label ? notes[run.label] : undefined;
    return {
      startedAt: run.startedAt,
      label: run.label,
      title: note?.title ?? null,
      summary: note?.summary ?? null,
      commit: run.git.commit,
      promptVersions: run.promptVersions,
      models: { classifier: run.models.classifier ?? null, answer: run.models.answer ?? null },
      repeat: run.filters.repeat,
      overall: run.summary.overall,
      suites: run.summary.suites,
      medianTotalMs: run.summary.medianTotalMs,
    };
  });

  const last = full.at(-1);
  if (!last?.results) return { runs, latest: null };

  const tally = new Map<string, HistoryCase>();
  for (const result of last.results) {
    const source = byId.get(result.id);
    const entry = tally.get(result.id) ?? {
      id: result.id,
      suite: result.suite,
      message: result.message,
      expected: source ? describeExpect(source.expect) : "",
      notes: source?.notes ?? null,
      passed: 0,
      total: 0,
    };
    entry.total += 1;
    if (result.pass) entry.passed += 1;
    tally.set(result.id, entry);
  }

  const failures = last.results
    .filter((result) => !result.pass)
    .map((result) => ({
      id: result.id,
      suite: result.suite,
      attempt: result.attempt,
      message: result.message,
      reasons: result.grades.filter((g) => !g.pass).map((g) => `${g.grader}: ${g.detail ?? "failed"}`),
      reply: result.text,
    }));

  return {
    runs,
    latest: { graders: last.summary.graders, cases: [...tally.values()], failures },
  };
}

export function readSavedRuns(dir = RESULTS_DIR): SavedRun[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as SavedRun);
}

export function readNotes(file = NOTES_FILE): RunNotes {
  return JSON.parse(readFileSync(file, "utf8")) as RunNotes;
}

export const serializeHistory = (history: EvalHistory) => `${JSON.stringify(history, null, 2)}\n`;
