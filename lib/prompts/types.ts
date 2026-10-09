import type { ModelMessage } from "ai";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Trusted instructions go in `system`; anything a visitor typed only ever goes in `messages`. */
export interface BuiltPrompt {
  system: string;
  messages: ModelMessage[];
}

export interface PromptModule<Input> {
  id: string;
  version: string;
  build(input: Input): BuiltPrompt;
}
