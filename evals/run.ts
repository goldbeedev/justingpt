/**
 * pnpm eval [--suite routing] [--case id] [--repeat 3] [--concurrency 4]
 *           [--classifier v1] [--answer v1] [--label name] [--dry-run]
 *
 * Runs eval cases through the real pipeline and real models, then writes
 * evals/results/<timestamp>-c<v>-a<v>[-label].json. Exits 1 if any security case fails.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadResumeData } from "@/lib/data/load";
import { getModels } from "@/lib/models";
import { getPrompt } from "@/lib/prompts/registry";
import { loadDatasets } from "./datasets";
import { runCases } from "./runner";
import { summarize, type Rate } from "./summary";
import type { CaseResult } from "./types";

const RESULTS_DIR = fileURLToPath(new URL("./results", import.meta.url));

const { values: args } = parseArgs({
  options: {
    suite: { type: "string", multiple: true },
    case: { type: "string", multiple: true },
    repeat: { type: "string", default: "1" },
    concurrency: { type: "string", default: "4" },
    classifier: { type: "string" },
    answer: { type: "string" },
    label: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const pct = (r: Rate) => `${(r.passRate * 100).toFixed(1)}% (${r.passed}/${r.total})`;

function git() {
  try {
    const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: "unknown", dirty: false };
  }
}

function progress(result: CaseResult) {
  if (result.pass) return process.stdout.write(".");
  const failed = result.grades.filter((g) => !g.pass);
  process.stdout.write(`\n✗ ${result.id}#${result.attempt}: ${failed.map((g) => `${g.grader} (${g.detail})`).join("; ")}\n`);
}

async function main() {
  const cases = loadDatasets().filter(
    (c) => (!args.suite || args.suite.includes(c.suite)) && (!args.case || args.case.includes(c.id)),
  );
  if (cases.length === 0) throw new Error("No cases match the given --suite/--case filters.");

  const promptVersions = {
    classifier: getPrompt("classifier", args.classifier).version,
    answer: getPrompt("answer", args.answer).version,
  };
  const repeat = Number(args.repeat);
  console.log(
    `Running ${cases.length} cases × ${repeat} with classifier ${promptVersions.classifier}, answer ${promptVersions.answer}`,
  );
  if (args["dry-run"]) return;

  const startedAt = new Date();
  const results = await runCases(cases, {
    models: getModels(),
    data: loadResumeData(),
    repeat,
    concurrency: Number(args.concurrency),
    promptVersions,
    onResult: progress,
  });
  const summary = summarize(results);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const label = args.label ? `-${args.label.replace(/[^a-z0-9-]/gi, "-")}` : "";
  const file = join(RESULTS_DIR, `${stamp}-c${promptVersions.classifier}-a${promptVersions.answer}${label}.json`);
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        label: args.label ?? null,
        git: git(),
        models: { classifier: process.env.CLASSIFIER_MODEL, answer: process.env.ANSWER_MODEL },
        promptVersions,
        filters: { suite: args.suite ?? null, case: args.case ?? null, repeat },
        summary,
        results,
      },
      null,
      2,
    )}\n`,
  );

  console.log("\n\nSuites");
  for (const [suite, r] of Object.entries(summary.suites)) console.log(`  ${suite.padEnd(10)} ${pct(r)}`);
  console.log("Graders");
  for (const [name, r] of Object.entries(summary.graders)) console.log(`  ${name.padEnd(20)} ${pct(r)}`);
  console.log(`Overall  ${pct(summary.overall)}`);
  console.log(
    `Median latency ${summary.medianTotalMs}ms · tokens ${summary.tokens.input} in (${summary.tokens.cachedInput} cached) / ${summary.tokens.output} out`,
  );
  console.log(`Saved ${file}`);

  // Security regressions are never acceptable; fail CI on any.
  const security = summary.suites.security;
  if (security && security.passed < security.total) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
