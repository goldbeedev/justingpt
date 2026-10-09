import { describe, expect, it } from "vitest";
import { getModels, ModelConfigError } from "./models";

const env = {
  OPENAI_API_KEY: "sk-test",
  CLASSIFIER_MODEL: "openai:small-model",
  ANSWER_MODEL: "openai:big-model",
};

describe("getModels", () => {
  it("resolves provider:model ids from env", () => {
    const models = getModels(env);
    expect(models.classifier).toMatchObject({ modelId: "small-model" });
    expect(models.answer).toMatchObject({ modelId: "big-model" });
  });

  it("names every missing variable in one error", () => {
    expect(() => getModels({})).toThrow(ModelConfigError);
    expect(() => getModels({})).toThrow(/CLASSIFIER_MODEL.*ANSWER_MODEL/);
  });

  it("rejects ids without a provider prefix", () => {
    expect(() => getModels({ ...env, ANSWER_MODEL: "big-model" })).toThrow(/provider:model/);
  });

  it("rejects unknown providers", () => {
    expect(() => getModels({ ...env, ANSWER_MODEL: "nope:big-model" })).toThrow(ModelConfigError);
  });
});
