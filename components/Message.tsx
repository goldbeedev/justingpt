import type { ChatUIMessage } from "@/lib/chat/types";
import { Markdown } from "./Markdown";
import { UnderTheHood } from "./UnderTheHood";

export function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="thinking-dot size-2 rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

export function Message({ message, showDetails }: { message: ChatUIMessage; showDetails: boolean }) {
  const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl bg-bubble px-5 py-2.5 whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }

  const details = message.parts.find((part) => part.type === "data-under-the-hood");

  return (
    <div>
      {text ? <Markdown>{text}</Markdown> : <ThinkingDots />}
      {showDetails && details && <UnderTheHood data={details.data} />}
    </div>
  );
}
