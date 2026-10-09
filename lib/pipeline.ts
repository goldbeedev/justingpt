import {
  generateText,
  NoObjectGeneratedError,
  Output,
  streamText,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import type { Category, ResumeData } from "@/lib/data/schemas";
import { selectContext } from "@/lib/data/select";
import { createCanary, createCanaryScanner } from "@/lib/guard/canary";
import { MAX_MESSAGE_LENGTH, normalize, preflight, type PreflightFlag } from "@/lib/guard/preflight";
import type { AnswerInput } from "@/lib/prompts/answer.v1";
import {
  classificationSchema,
  type Classification,
  type INJECTION_RISKS,
} from "@/lib/prompts/classification";
import type { ClassifierInput } from "@/lib/prompts/classifier.v1";
import { createNonce } from "@/lib/prompts/delimit";
import { getPrompt } from "@/lib/prompts/registry";
import type { ChatTurn, PromptModule } from "@/lib/prompts/types";

type Risk = (typeof INJECTION_RISKS)[number];

export const MAX_HISTORY_TURNS = 6;
export const MAX_TURN_LENGTH = 2000;
const MAX_ANSWER_TOKENS = 800;

// Reasoning models ignore temperature and can spend time "thinking" before the first token.
// Routing and grounded answers don't need it: benchmarked on gpt-5.4-nano/mini, "none" was
// fastest with identical routing ("low" was slower than the default). Older reasoning models
// (gpt-5, o-series) reject "none"; use "minimal" there. Other providers ignore this option.
const NO_REASONING = { openai: { reasoningEffort: "none" } } as const;

export const REPLIES = {
  refusal:
    "Nice try! I stick to my own rules here. Ask me about my experience, projects, or what I'm up to outside of work.",
  offTopic:
    "That's a bit outside my lane here. I'm happy to talk about my experience, skills, projects, or life outside of work, though!",
  tooLong: `That message is a little long for me. Could you trim it to under ${MAX_MESSAGE_LENGTH} characters?`,
  empty: "Ask me anything about my work or my life outside of it!",
  leak: "\n\nActually, let me stop there. Ask me about my work instead!",
};

/** Used when the classifier's output can't be parsed: load nothing, let the answer ask to clarify. */
export const FALLBACK_CLASSIFICATION: Classification = {
  intent: "meta",
  categories: [],
  storyTags: [],
  injectionRisk: "none",
  needsClarification: true,
  rationale: "Classifier output was invalid; falling back to a clarifying answer.",
};

export interface TokenUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

export type PipelinePath = "answered" | "refused" | "declined" | "rejected";

export type PipelineEvent =
  | {
      type: "meta";
      path: PipelinePath;
      classification: Classification | null;
      classifierFallback: boolean;
      risk: Risk;
      flags: PreflightFlag[];
      categories: Category[];
      storyIds: string[];
      promptVersions: { classifier: string; answer: string };
    }
  | { type: "text"; delta: string }
  | {
      type: "finish";
      canaryLeaked: boolean;
      usage: { classifier?: TokenUsage; answer?: TokenUsage };
      timings: { classifyMs?: number; answerMs?: number; totalMs: number };
    };

export interface PipelineInput {
  message: string;
  history: ChatTurn[];
  models: { classifier: LanguageModel; answer: LanguageModel };
  data: ResumeData;
  promptVersions?: { classifier?: string; answer?: string };
  /** Injectable for deterministic tests; generated per request otherwise. */
  ids?: { nonce: string; canary: string };
  abortSignal?: AbortSignal;
}

const toUsage = (usage: LanguageModelUsage): TokenUsage => ({
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
});

export async function classify(options: {
  model: LanguageModel;
  message: string;
  history: ChatTurn[];
  nonce: string;
  prompt?: PromptModule<ClassifierInput>;
  abortSignal?: AbortSignal;
}): Promise<{ classification: Classification; fallback: boolean; usage?: TokenUsage }> {
  const { model, message, history, nonce, prompt = getPrompt("classifier"), abortSignal } = options;
  const { system, messages } = prompt.build({ message, history, nonce });

  try {
    const result = await generateText({
      model,
      system,
      messages,
      output: Output.object({ schema: classificationSchema }),
      providerOptions: NO_REASONING,
      abortSignal,
    });
    return { classification: result.output, fallback: false, usage: toUsage(result.usage) };
  } catch (error) {
    // Bad output is recoverable; provider/network errors are not ours to hide.
    if (NoObjectGeneratedError.isInstance(error)) {
      return { classification: FALLBACK_CLASSIFICATION, fallback: true };
    }
    throw error;
  }
}

/** Preflight flags raise suspicion by one level; the classifier alone can reach "high". */
export function resolveRisk(classifierRisk: Risk, flags: PreflightFlag[]): Risk {
  if (flags.length === 0 || classifierRisk === "high") return classifierRisk;
  return classifierRisk === "low" ? "high" : "low";
}

/** History is client-supplied: keep it short, bounded, normalized, and starting on a user turn. */
export function trimHistory(history: ChatTurn[]): ChatTurn[] {
  const turns = history
    .map((turn) => ({ role: turn.role, content: normalize(turn.content) }))
    .filter((turn) => turn.content.length > 0)
    .map((turn) =>
      turn.content.length > MAX_TURN_LENGTH
        ? { ...turn, content: `${turn.content.slice(0, MAX_TURN_LENGTH)}…` }
        : turn,
    )
    .slice(-MAX_HISTORY_TURNS);
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

export async function* runPipeline(input: PipelineInput): AsyncGenerator<PipelineEvent> {
  const startedAt = performance.now();
  const elapsed = (since: number) => Math.round(performance.now() - since);
  const { nonce, canary } = input.ids ?? { nonce: createNonce(), canary: createCanary() };
  const classifierPrompt = getPrompt("classifier", input.promptVersions?.classifier);
  const answerPrompt: PromptModule<AnswerInput> = getPrompt("answer", input.promptVersions?.answer);

  const meta = {
    type: "meta" as const,
    classification: null as Classification | null,
    classifierFallback: false,
    risk: "none" as Risk,
    flags: [] as PreflightFlag[],
    categories: [] as Category[],
    storyIds: [] as string[],
    promptVersions: { classifier: classifierPrompt.version, answer: answerPrompt.version },
  };

  const checked = preflight(input.message);
  if (!checked.ok) {
    yield { ...meta, path: "rejected" };
    yield { type: "text", delta: checked.reason === "too_long" ? REPLIES.tooLong : REPLIES.empty };
    yield { type: "finish", canaryLeaked: false, usage: {}, timings: { totalMs: elapsed(startedAt) } };
    return;
  }

  const history = trimHistory(input.history);
  const classifyStartedAt = performance.now();
  const classified = await classify({
    model: input.models.classifier,
    message: checked.text,
    history,
    nonce,
    prompt: classifierPrompt,
    abortSignal: input.abortSignal,
  });
  const classifyMs = elapsed(classifyStartedAt);
  const { classification } = classified;
  const risk = resolveRisk(classification.injectionRisk, checked.flags);

  Object.assign(meta, {
    classification,
    classifierFallback: classified.fallback,
    risk,
    flags: checked.flags,
  });

  const fixedReply =
    risk === "high"
      ? { path: "refused" as const, text: REPLIES.refusal }
      : classification.intent === "off_topic"
        ? { path: "declined" as const, text: REPLIES.offTopic }
        : null;

  if (fixedReply) {
    yield { ...meta, path: fixedReply.path };
    yield { type: "text", delta: fixedReply.text };
    yield {
      type: "finish",
      canaryLeaked: false,
      usage: { classifier: classified.usage },
      timings: { classifyMs, totalMs: elapsed(startedAt) },
    };
    return;
  }

  const context = selectContext(input.data, {
    categories: classification.categories,
    storyTags: classification.storyTags,
  });
  meta.categories = Object.keys(context) as Category[];
  meta.storyIds = context.stories?.map((story) => story.id) ?? [];
  yield { ...meta, path: "answered" };

  const { system, messages } = answerPrompt.build({
    context,
    voice: input.data.personal.voice,
    intent: classification.intent,
    message: checked.text,
    history,
    nonce,
    canary,
  });

  const answerStartedAt = performance.now();
  const result = streamText({
    model: input.models.answer,
    system,
    messages,
    maxOutputTokens: MAX_ANSWER_TOKENS,
    providerOptions: NO_REASONING,
    abortSignal: input.abortSignal,
    onError: () => {}, // Errors are rethrown from the stream below; the route logs them once.
  });

  const scanner = createCanaryScanner(canary);
  let canaryLeaked = false;
  // fullStream rather than textStream: textStream ends silently on provider errors.
  for await (const part of result.fullStream) {
    if (part.type === "error") throw part.error;
    if (part.type !== "text-delta") continue;
    const { safe, leaked } = scanner.push(part.text);
    if (safe) yield { type: "text", delta: safe };
    if (leaked) {
      canaryLeaked = true;
      yield { type: "text", delta: REPLIES.leak };
      break; // Leaving the loop cancels the model stream.
    }
  }
  const rest = scanner.flush();
  if (rest) yield { type: "text", delta: rest };

  yield {
    type: "finish",
    canaryLeaked,
    usage: {
      classifier: classified.usage,
      // A cancelled stream never reports usage, so don't wait on it after a leak.
      answer: canaryLeaked ? undefined : toUsage(await result.totalUsage),
    },
    timings: { classifyMs, answerMs: elapsed(answerStartedAt), totalMs: elapsed(startedAt) },
  };
}
