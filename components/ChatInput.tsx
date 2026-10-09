"use client";

import { useLayoutEffect, useRef } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/guard/preflight";
import { ArrowUpIcon, StopIcon } from "./icons";

const MAX_HEIGHT_PX = 200;
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
}

export function ChatInput({ value, onChange, onSubmit, onStop, busy }: ChatInputProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const canSend = !busy && value.trim().length > 0;

  // Grow with content up to a cap, like ChatGPT's composer.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  return (
    <form
      className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-composer p-2 pl-5 shadow-sm focus-within:border-muted/50"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        ref={textarea}
        rows={1}
        autoFocus
        value={value}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Ask me anything"
        className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
      />
      {value.length > COUNTER_THRESHOLD && (
        <span className="self-center text-xs text-muted tabular-nums">
          {value.length}/{MAX_MESSAGE_LENGTH}
        </span>
      )}
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
        >
          <ArrowUpIcon />
        </button>
      )}
    </form>
  );
}
