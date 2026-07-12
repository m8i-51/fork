import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeInlineText } from "@fork/shared";

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

export function Chat({ messages, onSend }: Props) {
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
  }, [messages.length]);

  const items = useMemo(() => messages.slice(-200), [messages]);

  const send = () => {
    const t = sanitizeInlineText(text.trim());
    if (!t) return;
    setText("");
    onSend(t);
  };

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef}>
        {items.map((m) => (
          <div key={m.id} className={`chat-msg ${m.self ? "self" : "other"}`}>
            {!m.self && <div className="chat-meta" style={{ marginBottom: 2 }}>{m.from}</div>}
            <div>{m.text}</div>
          </div>
        ))}
        {hasUnread && (
          <div className="chat-new">
            <button
              type="button"
              onClick={() => {
                const el = listRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                setHasUnread(false);
              }}
            >
              新着メッセージ
            </button>
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          className="input"
          placeholder="メッセージを入力"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="btn" style={{ marginTop: 8 }} onClick={send}>
          ✈ 送信
        </button>
      </div>
    </div>
  );
}
