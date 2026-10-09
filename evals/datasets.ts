import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { evalCaseSchema, type EvalCase } from "./types";

export const DATASETS_DIR = fileURLToPath(new URL("./datasets", import.meta.url));

/** Loads every *.jsonl dataset; a bad line fails with its file and line number. */
export function loadDatasets(dir = DATASETS_DIR): EvalCase[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  return files.flatMap((file) =>
    readFileSync(join(dir, file), "utf8")
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => line.length > 0)
      .map(({ line, number }) => {
        try {
          return evalCaseSchema.parse(JSON.parse(line));
        } catch (error) {
          const reason = error instanceof z.ZodError ? z.prettifyError(error) : (error as Error).message;
          throw new Error(`${file}:${number}\n${reason}`);
        }
      }),
  );
}
