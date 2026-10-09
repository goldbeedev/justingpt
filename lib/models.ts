import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry, type LanguageModel } from "ai";

export class ModelConfigError extends Error {
  name = "ModelConfigError";
}

type Env = Record<string, string | undefined>;

export interface Models {
  classifier: LanguageModel;
  answer: LanguageModel;
}

/** Register more providers here (e.g. Anthropic) to make them selectable from env. */
function createRegistry(env: Env) {
  return createProviderRegistry({
    openai: createOpenAI({ apiKey: env.OPENAI_API_KEY }),
  });
}

function resolveModel(registry: ReturnType<typeof createRegistry>, variable: string, id: string) {
  if (!/^[a-z0-9-]+:.+$/.test(id)) {
    throw new ModelConfigError(`${variable} must look like "provider:model", got "${id}"`);
  }
  try {
    return registry.languageModel(id as `openai:${string}`);
  } catch (error) {
    throw new ModelConfigError(`${variable}: ${(error as Error).message}`);
  }
}

function requireVars<K extends string>(env: Env, names: K[]): Record<K, string> {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new ModelConfigError(`Missing environment variables: ${missing.join(", ")}`);
  }
  return Object.fromEntries(names.map((name) => [name, env[name]])) as Record<K, string>;
}

/** Model ids are config, not code: `CLASSIFIER_MODEL=openai:<model-id>`. */
export function getModels(env: Env = process.env): Models {
  const vars = requireVars(env, ["CLASSIFIER_MODEL", "ANSWER_MODEL"]);
  const registry = createRegistry(env);
  return {
    classifier: resolveModel(registry, "CLASSIFIER_MODEL", vars.CLASSIFIER_MODEL),
    answer: resolveModel(registry, "ANSWER_MODEL", vars.ANSWER_MODEL),
  };
}

/** The LLM-as-judge model for evals; kept separate so it can be stronger than the app's models. */
export function getJudgeModel(env: Env = process.env): LanguageModel {
  const { JUDGE_MODEL } = requireVars(env, ["JUDGE_MODEL"]);
  return resolveModel(createRegistry(env), "JUDGE_MODEL", JUDGE_MODEL);
}
