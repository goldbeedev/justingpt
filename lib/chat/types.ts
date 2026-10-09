import type { UIMessage } from "ai";
import type { PipelineEvent } from "@/lib/pipeline";

type MetaEvent = Extract<PipelineEvent, { type: "meta" }>;
type FinishEvent = Extract<PipelineEvent, { type: "finish" }>;

/** Everything the "Under the hood" panel shows for one assistant message. */
export type UnderTheHood = Omit<MetaEvent, "type"> & { finish?: Omit<FinishEvent, "type"> };

export type ChatUIMessage = UIMessage<never, { "under-the-hood": UnderTheHood }>;
