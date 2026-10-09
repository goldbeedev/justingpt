import type { UnderTheHood as UnderTheHoodData } from "@/lib/chat/types";

const PATH_LABELS: Record<UnderTheHoodData["path"], string> = {
  answered: "answered",
  refused: "refused (injection guard)",
  declined: "declined (off-topic)",
  rejected: "rejected (input check)",
};

const RISK_STYLES = {
  none: "text-emerald-600 dark:text-emerald-400",
  low: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

const tokens = (usage?: { inputTokens?: number; outputTokens?: number }) =>
  usage ? `${usage.inputTokens ?? "?"} in / ${usage.outputTokens ?? "?"} out` : "-";

const ms = (value?: number) => (value === undefined ? "-" : `${value} ms`);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function UnderTheHood({ data }: { data: UnderTheHoodData }) {
  const { classification, finish } = data;

  return (
    <details className="group mt-3 rounded-xl border border-border bg-surface text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-muted select-none hover:text-foreground">
        <span className="transition-transform group-open:rotate-90">▸</span>
        <span className="font-medium">Under the hood</span>
        <span className="truncate">
          · {PATH_LABELS[data.path]}
          {classification && ` · ${classification.intent}`}
          {finish && ` · ${ms(finish.timings.totalMs)}`}
        </span>
      </summary>

      <div className="space-y-3 border-t border-border px-3 py-3">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5">
          <Row label="Path">{PATH_LABELS[data.path]}</Row>
          {classification && <Row label="Intent">{classification.intent}</Row>}
          <Row label="Injection risk">
            <span className={RISK_STYLES[data.risk]}>{data.risk}</span>
            {data.flags.length > 0 && <span className="text-muted"> · preflight: {data.flags.join(", ")}</span>}
          </Row>
          <Row label="Data loaded">{data.categories.length > 0 ? data.categories.join(", ") : "none"}</Row>
          {data.storyIds.length > 0 && <Row label="Stories">{data.storyIds.join(", ")}</Row>}
          <Row label="Prompts">
            classifier {data.promptVersions.classifier} · answer {data.promptVersions.answer}
          </Row>
          {data.classifierFallback && <Row label="Classifier">invalid output, used fallback</Row>}
          {finish && (
            <>
              <Row label="Tokens">
                classifier {tokens(finish.usage.classifier)} · answer {tokens(finish.usage.answer)}
              </Row>
              <Row label="Latency">
                classify {ms(finish.timings.classifyMs)} · answer {ms(finish.timings.answerMs)} · total{" "}
                {ms(finish.timings.totalMs)}
              </Row>
              <Row label="Canary">
                {finish.canaryLeaked ? (
                  <span className={RISK_STYLES.high}>tripped, stream stopped</span>
                ) : (
                  "clean"
                )}
              </Row>
            </>
          )}
        </dl>

        {classification && (
          <div>
            <div className="mb-1 text-muted">Classifier output (structured JSON)</div>
            <pre className="overflow-x-auto rounded-lg bg-background p-2 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(classification, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}
