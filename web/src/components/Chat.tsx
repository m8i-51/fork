import React, { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeInlineText } from "@/lib/validation";
import { RoomEvent, type Room } from "livekit-client";

type ChatMessage = {
  id: string;
  from: string;
  text: string;
  ts: number;
  self?: boolean;
};

export function Chat({ room }: { room: Room | undefined }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, participant?: any, _?: any, topic?: string) => {
      if (topic && topic !== "chat") return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg && msg.type === "chat" && typeof msg.text === "string") {
          const clean = sanitizeInlineText(msg.text);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              from: participant?.name || participant?.identity || "anon",
              text: clean,
              ts: Date.now(),
              self: participant?.identity && room?.localParticipant?.identity === participant.identity,
            },
          ]);
        }
      } catch {}
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (!mountedRef.current || last?.self || nearBottom) {
      el.scrollTop = el.scrollHeight;
      setHasUnread(false);
    } else {
      setHasUnread(true);
    }
    mountedRef.current = true;
  }, [messages.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (nearBottom) setHasUnread(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => { el.removeEventListener('scroll', onScroll); };
  }, []);

  const send = async () => {
    const t = sanitizeInlineText(text.trim());
    if (!t || !room) return;
    setText("");
    const payload = new TextEncoder().encode(JSON.stringify({ type: "chat", text: t }));
    await room.localParticipant.publishData(payload, { reliable: true, topic: "chat" });
    // 楽観的に自分のメッセージも表示
    try {
      const from = (room.localParticipant as any)?.name || room.localParticipant?.identity || "me";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), from, text: t, ts: Date.now(), self: true },
      ]);
      const el = listRef.current; if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  const items = useMemo(() => messages.slice(-200), [messages]);

  return (
    <div className="chat">
      <div className="chat-messages" ref={listRef}>
        {items.map((m) => (
          <div key={m.id} className={`chat-msg ${m.self ? 'self' : 'other'}`}>
            {!m.self && (<div className="chat-meta" style={{ marginBottom: 2 }}>{m.from}</div>)}
            <div>{m.text}</div>
          </div>
        ))}
        {hasUnread && (
          <div className="chat-new"><button onClick={() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; setHasUnread(false); }}>新着メッセージ</button></div>
        )}
      </div>
      <div className="chat-input">
        <input
          className="input"
          placeholder="メッセージを入力"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="btn" onClick={send}>✈ 送信</button>
      </div>
    </div>
  );
}
