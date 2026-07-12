import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { sanitizeInlineText } from "@fork/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  from: string;
  text: string;
  ts: number;
  self?: boolean;
};

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, onSend }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (last?.self || nearBottom) {
      el.scrollTop = el.scrollHeight;
      setHasUnread(false);
    } else {
      setHasUnread(true);
    }
  }, [messages.length, messages]);

  const items = useMemo(() => messages.slice(-200), [messages]);

  const send = () => {
    const t = sanitizeInlineText(text.trim());
    if (!t) return;
    setText("");
    onSend(t);
  };

  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-border lg:min-h-[420px]">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
              m.self
                ? "ml-auto rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm border border-border bg-card",
            )}
          >
            {!m.self && <div className="mb-0.5 text-xs text-muted-foreground">{m.from}</div>}
            <div>{m.text}</div>
          </div>
        ))}
        {hasUnread && (
          <div className="sticky bottom-0 text-right">
            <Button
              type="button"
              size="xs"
              onClick={() => {
                const el = listRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                setHasUnread(false);
              }}
            >
              新着メッセージ
            </Button>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          placeholder="メッセージを入力"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1"
        />
        <Button type="button" size="icon" onClick={send} aria-label="送信">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
