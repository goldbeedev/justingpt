"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { describeChatError } from "@/lib/chat/errors";
import type { ChatUIMessage } from "@/lib/chat/types";
import { ChatInput } from "./ChatInput";
import { NewChatIcon } from "./icons";
import { Message, ThinkingDots } from "./Message";
import { Typewriter } from "./Typewriter";
import { useStoredToggle } from "./useStoredToggle";

const DETAILS_KEY = "justingpt:under-the-hood";
const STICK_TO_BOTTOM_PX = 80;

export function Chat({ name, greeting }: { name: string; greeting: string }) {
  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } =
    useChat<ChatUIMessage>({
      // A fixed id keeps the page prerenderable: otherwise useChat generates one with
      // Math.random() during SSR, which Cache Components rejects.
      id: "justingpt",
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });
  const [input, setInput] = useState("");
  const [showDetails, setShowDetails] = useStoredToggle(DETAILS_KEY);
  const scroller = useRef<HTMLElement>(null);
  const stickToBottom = useRef(true);

  const busy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;
  const awaitingFirstChunk = status === "submitted" && messages.at(-1)?.role === "user";
  const errorInfo = error ? describeChatError(error) : null;

  // Follow streaming text unless the visitor has scrolled up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    clearError();
    stickToBottom.current = true;
    sendMessage({ text });
    setInput("");
  };

  const newChat = () => {
    stop();
    setMessages([]);
    clearError();
    setInput("");
  };

  const composer = (
    <>
      <ChatInput value={input} onChange={setInput} onSubmit={submit} onStop={stop} busy={busy} />
      <p className="mt-2 text-center text-xs text-muted">
        An AI version of {name}. Answers come from my real resume, but it can make mistakes.
      </p>
    </>
  );

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="text-lg font-semibold">JustinGPT</span>
          {!empty && (
            <button
              type="button"
              onClick={newChat}
              aria-label="New chat"
              title="New chat"
              className="ml-2 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"
            >
              <NewChatIcon />
            </button>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted select-none">
          Under the hood
          <input
            type="checkbox"
            role="switch"
            checked={showDetails}
            onChange={(event) => setShowDetails(event.target.checked)}
            className="toggle"
          />
        </label>
      </header>

      {empty ? (
        <main className="flex flex-1 flex-col items-center justify-center px-4 pb-[12vh]">
          <Typewriter text={greeting} />
          <div className="mt-8 w-full max-w-3xl">{composer}</div>
        </main>
      ) : (
        <>
          <main
            ref={scroller}
            className="flex-1 overflow-y-auto"
            onScroll={(event) => {
              const el = event.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
            }}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6" aria-live="polite">
              {messages.map((message) => (
                <Message key={message.id} message={message} showDetails={showDetails} />
              ))}
              {awaitingFirstChunk && <ThinkingDots />}
              {errorInfo && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm"
                >
                  <span>{errorInfo.message}</span>
                  {errorInfo.retryable && (
                    <button type="button" onClick={() => regenerate()} className="font-medium underline">
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          </main>
          <footer className="px-4 pb-4">
            <div className="mx-auto max-w-3xl">{composer}</div>
          </footer>
        </>
      )}
    </div>
  );
}
