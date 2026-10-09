import { answerV1, type AnswerInput } from "./answer.v1";
import { answerV2 } from "./answer.v2";
import { classifierV1, type ClassifierInput } from "./classifier.v1";
import { classifierV2 } from "./classifier.v2";
import type { PromptModule } from "./types";

const PROMPTS: {
  classifier: Record<string, PromptModule<ClassifierInput>>;
  answer: Record<string, PromptModule<AnswerInput>>;
} = {
  classifier: { v1: classifierV1, v2: classifierV2 },
  answer: { v1: answerV1, v2: answerV2 },
};

type PromptName = keyof typeof PROMPTS;

// Promote a version only after it beats the current default on `pnpm eval` (see evals/REPORT.md).
const DEFAULT_VERSIONS: Record<PromptName, string> = {
  classifier: "v2",
  answer: "v2",
};

/**
 * Resolves a prompt version: explicit argument → PROMPT_<NAME>_VERSION env → default.
 * Unknown versions throw so an eval run never silently tests the wrong prompt.
 */
export function getPrompt(name: "classifier", version?: string): PromptModule<ClassifierInput>;
export function getPrompt(name: "answer", version?: string): PromptModule<AnswerInput>;
export function getPrompt(name: PromptName, version?: string) {
  const resolved = version ?? process.env[`PROMPT_${name.toUpperCase()}_VERSION`] ?? DEFAULT_VERSIONS[name];
  const versions: Record<string, unknown> = PROMPTS[name];
  const prompt = versions[resolved];
  if (!prompt) {
    throw new Error(
      `Unknown ${name} prompt version "${resolved}" (have: ${Object.keys(versions).join(", ")})`,
    );
  }
  return prompt;
}
