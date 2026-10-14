import type { Metadata } from "next";
import Link from "next/link";
import type { Rate } from "@/evals/summary";
import type { EvalHistory, HistoryCase, HistoryRun } from "@/evals/history";
import historyJson from "@/evals/history.json";

export const metadata: Metadata = {
  title: "How JustinGPT is tested",
  description: "Every prompt change to JustinGPT is scored against a regression suite. Here's the full record.",
};

const history = historyJson as EvalHistory;

const SUITES: Record<string, { name: string; description: string }> = {
  routing: {
    name: "Routing",
    description: "Real questions about my work. Does it understand what's being asked and pull the right part of my resume?",
  },
  security: {
    name: "Security",
    description: "Prompt-injection and jailbreak attempts, plus look-alike innocent questions that must not be refused.",
  },
  scope: {
    name: "Scope",
    description: "Off-topic requests (poems, homework, cover letters) it should politely decline instead of answering.",
  },
};

const GRADERS: Record<string, string> = {
  path: "Answered, declined, or refused as expected",
  intent: "Understood what the question is about",
  categories: "Loaded the right parts of my resume, and only those",
  risk: "Rated the injection risk correctly",
  storyTags: "Picked a relevant story for behavioral questions",
  validTags: "Never invented a story that doesn't exist",
  mustNotContain: "Never said a forbidden phrase",
  schemaValid: "Classifier returned well-formed output",
  answerModelSkipped: "Didn't call the answer model when it shouldn't",
  noCanaryLeak: "Never leaked the hidden canary token",
  noPromptLeak: "Never revealed its instructions",
  firstPerson: "Spoke as me, in the first person",
  noFillerSignoff: "No filler like \"Let me know if you have questions!\"",
  noInternalTerms: "Never mentioned its own plumbing",
  maxWords: "Kept answers short",
};

const percent = (rate: Rate, digits = 0) => `${(rate.passRate * 100).toFixed(digits)}%`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const promptLabel = (run: HistoryRun) =>
  run.promptVersions.classifier === run.promptVersions.answer
    ? `${run.promptVersions.classifier} prompts`
    : `classifier ${run.promptVersions.classifier} · answer ${run.promptVersions.answer}`;

export default function EvalsPage() {
  const { runs, latest } = history;
  const current = runs.at(-1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <nav className="mb-10">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back to the chat
        </Link>
      </nav>

      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How this bot is tested</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          A chatbot that speaks for me has to be right about me and hard to trick. Every time I change a prompt, a
          model, or my resume data, I re-run a fixed set of test questions through the real pipeline and score every
          reply with code, not vibes. This page is the record.
        </p>
      </header>

      {current && <Headline run={current} />}

      {runs.length > 1 && (
        <Section title="Score over time" lede="Each column is one full run of the suite. A dip usually means the test got stricter; the notes below say why.">
          <RunChart runs={runs} />
        </Section>
      )}

      <Section title="What changed, run by run" lede="Newest first.">
        <ol className="flex flex-col gap-4">
          {[...runs].reverse().map((run, i, newestFirst) => (
            <RunEntry key={run.startedAt} run={run} previous={newestFirst[i + 1]} />
          ))}
        </ol>
      </Section>

      {latest && (
        <>
          <Section
            title="What gets checked"
            lede="Every reply is scored by deterministic checks written in code. Each check only runs where it applies, so the counts differ."
          >
            <ul className="divide-y divide-border rounded-xl border border-border">
              {Object.entries(latest.graders).map(([name, rate]) => (
                <li key={name} className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
                  <span>{GRADERS[name] ?? name}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {rate.passed}/{rate.total}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Every test case"
            lede={`Results from the latest run. Model replies vary, so each case runs ${current?.repeat ?? 1} times and every attempt has to pass.`}
          >
            <div className="flex flex-col gap-3">
              {Object.keys(SUITES).map((suite) => (
                <CaseGroup key={suite} suite={suite} cases={latest.cases.filter((c) => c.suite === suite)} />
              ))}
            </div>
          </Section>

          <Section
            title="What still fails"
            lede="Shown on purpose. A suite that always passes isn't testing anything hard enough."
          >
            {latest.failures.length === 0 ? (
              <p className="text-muted">Nothing in the latest run.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {latest.failures.map((failure) => (
                  <li key={`${failure.id}-${failure.attempt}`} className="rounded-xl border border-border p-4">
                    <p className="text-xs text-muted">
                      {SUITES[failure.suite]?.name ?? failure.suite} · <code>{failure.id}</code> · attempt {failure.attempt}
                    </p>
                    <p className="mt-2 font-medium">“{failure.message}”</p>
                    <ul className="mt-2 text-sm text-muted">
                      {failure.reasons.map((reason) => (
                        <li key={reason}>✗ {reason}</li>
                      ))}
                    </ul>
                    <p className="mt-3 rounded-lg bg-bubble px-3 py-2 text-sm">{failure.reply}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Section title="The fine print">
        <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed text-muted">
          <li>
            I wrote the test cases myself, so a high score means the bot handles what I thought to test. When real
            visitors ask something it gets wrong, that question becomes a new test case.
          </li>
          <li>
            The checks are plain code (string, schema, and routing checks), not another AI grading the AI. That makes
            them cheap, repeatable, and impossible to sweet-talk, but they can&apos;t judge whether an answer is
            insightful.
          </li>
          {current?.models.classifier && current.models.answer && (
            <li>
              Latest run: <code>{current.models.classifier}</code> classifies each question,{" "}
              <code>{current.models.answer}</code> writes the answer. Median reply time{" "}
              {(current.medianTotalMs / 1000).toFixed(1)}s.
            </li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {lede && <p className="mt-1 text-sm text-muted">{lede}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Headline({ run }: { run: HistoryRun }) {
  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-sm text-muted">Latest run · {formatDate(run.startedAt)}</p>
      <p className="mt-1 text-5xl font-semibold tracking-tight">{percent(run.overall, 1)}</p>
      <p className="mt-1 text-sm text-muted">
        {run.overall.passed} of {run.overall.total} test replies passed every check
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Object.entries(SUITES).map(([key, suite]) => {
          const rate = run.suites[key];
          if (!rate) return null;
          return (
            <div key={key}>
              <p className="text-sm font-medium">
                {suite.name} <span className="font-normal text-muted">· {percent(rate)}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{suite.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Fixed categorical order: the first prompt version gets series 1, the next series 2.
const SERIES = ["bg-series-1", "bg-series-2"];

function RunChart({ runs }: { runs: HistoryRun[] }) {
  const versions = [...new Set(runs.map(promptLabel))];
  const color = (run: HistoryRun) => SERIES[versions.indexOf(promptLabel(run))] ?? "bg-muted";

  return (
    <figure>
      {versions.length > 1 && (
        <ul className="mb-4 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
          {versions.map((version, i) => (
            <li key={version} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-sm ${SERIES[i] ?? "bg-muted"}`} aria-hidden />
              {version}
            </li>
          ))}
        </ul>
      )}
      <div className="relative ml-9 h-56">
        {[100, 50, 0].map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0 border-t border-border"
            style={{ bottom: `${tick}%` }}
            aria-hidden
          >
            <span className="absolute -left-9 -translate-y-1/2 text-xs text-muted tabular-nums">{tick}%</span>
          </div>
        ))}
        <ol className="absolute inset-0 flex items-end justify-around" aria-label="Overall pass rate by run">
          {runs.map((run) => (
            <li
              key={run.startedAt}
              className="relative flex h-full w-full justify-center"
              title={`${run.title ?? run.label ?? "Run"}: ${percent(run.overall, 1)} (${promptLabel(run)})`}
            >
              <span
                className={`absolute bottom-0 w-6 rounded-t-[4px] ${color(run)}`}
                style={{ height: `${run.overall.passRate * 100}%` }}
                aria-hidden
              />
              <span
                className="absolute mb-1 text-xs font-medium tabular-nums"
                style={{ bottom: `${run.overall.passRate * 100}%` }}
              >
                {percent(run.overall)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <ol className="ml-9 mt-2 flex justify-around text-center text-xs text-muted" aria-hidden>
        {runs.map((run) => (
          <li key={run.startedAt} className="w-full px-0.5 break-words">
            {run.label ?? formatDate(run.startedAt)}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function RunEntry({ run, previous }: { run: HistoryRun; previous?: HistoryRun }) {
  const delta = previous ? Math.round((run.overall.passRate - previous.overall.passRate) * 100) : null;
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-medium">{run.title ?? run.label ?? "Eval run"}</h3>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{percent(run.overall, 1)}</span>
          {delta !== null && delta !== 0 && (
            <span className="ml-1.5 text-muted">
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts
            </span>
          )}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        {formatDate(run.startedAt)} · {promptLabel(run)} · commit <code>{run.commit}</code>
      </p>
      {run.summary && <p className="mt-3 text-sm leading-relaxed">{run.summary}</p>}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {Object.entries(SUITES).map(([key, suite]) =>
          run.suites[key] ? (
            <span key={key}>
              {suite.name} {percent(run.suites[key])}
            </span>
          ) : null,
        )}
      </p>
    </li>
  );
}

function CaseGroup({ suite, cases }: { suite: string; cases: HistoryCase[] }) {
  if (cases.length === 0) return null;
  const perfect = cases.filter((c) => c.passed === c.total).length;
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex cursor-pointer items-baseline justify-between gap-4 px-4 py-3">
        <span className="font-medium">
          {SUITES[suite]?.name ?? suite} <span className="font-normal text-muted">· {cases.length} cases</span>
        </span>
        <span className="text-sm text-muted tabular-nums">
          {perfect}/{cases.length} perfect
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {cases.map((c) => (
          <li key={c.id} className="flex gap-3 px-4 py-3 text-sm">
            <span
              className={`shrink-0 tabular-nums ${c.passed === c.total ? "text-muted" : "font-semibold"}`}
              aria-label={`${c.passed} of ${c.total} attempts passed`}
            >
              {c.passed === c.total ? "✓" : "✗"} {c.passed}/{c.total}
            </span>
            <div className="min-w-0">
              <p className="break-words whitespace-pre-wrap">{c.message}</p>
              <p className="mt-1 text-xs text-muted">Expected: {c.expected}</p>
              {c.notes && <p className="mt-1 text-xs text-muted italic">{c.notes}</p>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
