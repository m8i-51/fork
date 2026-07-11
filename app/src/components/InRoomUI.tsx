import { useCallback, useEffect, useRef, useState } from "react";
import { Chat, type ChatMessage } from "./Chat";
import { Participants } from "./Participants";
import { SfuAudioClient, type ConnectionState } from "../lib/sfu-client";
import { connectRoomWs, sendChat, sendKick, sendReaction, type RoomWsHandlers } from "../lib/room-ws";
import { api } from "../lib/api";

type Props = {
  roomName: string;
  displayTitle: string;
  isHost: boolean;
  userId: string;
  userName: string;
  onLeave: () => void;
};

export function InRoomUI({ roomName, displayTitle, isHost, userId, userName, onLeave }: Props) {
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [viewerCount, setViewerCount] = useState(0);
  const [participants, setParticipants] = useState<Array<{ identity: string; name: string }>>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, gift: 0 });
  const [isPublicState, setIsPublicState] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [floats, setFloats] = useState<Array<{ id: string; type: "like" | "gift" }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioNeedsUnlock, setAudioNeedsUnlock] = useState(false);

  const sfuRef = useRef<SfuAudioClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hostHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnFloat = (type: "like" | "gift") => {
    const id = crypto.randomUUID();
    setFloats((f) => [...f, { id, type }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
  };

  const leaveRoom = useCallback(async () => {
    if (hostHeartbeatRef.current) clearInterval(hostHeartbeatRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    await sfuRef.current?.disconnect(roomName);
    sfuRef.current = null;
    if (isHost) {
      await fetch("/api/room/end", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ room: roomName }),
      }).catch(() => undefined);
    }
    onLeave();
  }, [isHost, onLeave, roomName]);

  useEffect(() => {
    let cancelled = false;

    const wsHandlers: RoomWsHandlers = {
      onViewers: setViewerCount,
      onChatHistory: (history) => {
        setMessages(
          history.map((m) => ({
            ...m,
            self: m.from === userName,
          })),
        );
      },
      onChat: (message) => {
        setMessages((prev) => [...prev, { ...message, self: message.from === userName }]);
      },
      onParticipants: (list) => setParticipants(list),
      onHostTrack: async (trackName) => {
        if (isHost || cancelled) return;
        try {
          await sfuRef.current?.joinAsViewer(roomName, trackName);
        } catch (e) {
          setError(e instanceof Error ? e.message : "視聴接続に失敗しました");
        }
      },
      onStreamEnded: () => {
        alert("配信が終了しました");
        void leaveRoom();
      },
      onKick: (target) => {
        if (target === userId) {
          alert("ホストによって退室させられました");
          void leaveRoom();
        }
      },
      onReaction: (type) => {
        setReactions((prev) => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
        spawnFloat(type);
      },
    };

    const connect = async () => {
      try {
        const info = await api<{
          isPublic: boolean;
        }>(`/api/room/info?room=${encodeURIComponent(roomName)}`);
        if (!cancelled) setIsPublicState(info.isPublic);

        const summary = await api<{ summary: Record<string, number> }>(
          `/api/reaction/summary?room=${encodeURIComponent(roomName)}`,
        );
        if (!cancelled) setReactions((prev) => ({ ...prev, ...summary.summary }));

        const client = new SfuAudioClient({
          onConnectionState: setConnState,
          onRemoteAudio: (track) => {
            if (!audioRef.current) {
              audioRef.current = new Audio();
              audioRef.current.autoplay = true;
            }
            audioRef.current.srcObject = new MediaStream([track]);
            audioRef.current.play().catch(() => setAudioNeedsUnlock(true));
          },
          onError: setError,
        });
        sfuRef.current = client;

        wsRef.current = connectRoomWs(roomName, userId, userName, isHost, wsHandlers);

        if (isHost) {
          await client.joinAsHost(roomName);
          hostHeartbeatRef.current = setInterval(() => {
            void fetch("/api/room/host-heartbeat", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ room: roomName }),
            });
          }, 20000);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "接続に失敗しました");
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (hostHeartbeatRef.current) clearInterval(hostHeartbeatRef.current);
      wsRef.current?.close();
      void sfuRef.current?.disconnect(roomName);
    };
  }, [isHost, leaveRoom, roomName, userId, userName]);

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(`${location.origin}/room/${roomName}?publish=false`);
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      {error && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {error}
        </div>
      )}
      {audioNeedsUnlock && (
        <div className="card" style={{ background: "#fff7ed", borderColor: "#fb923c" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>ブラウザの制限で音声が停止しています。</div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void audioRef.current?.play();
                setAudioNeedsUnlock(false);
              }}
            >
              音声を有効化
            </button>
          </div>
        </div>
      )}

      <div className="topbar" style={{ position: "sticky", top: 8, zIndex: 10 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <div
            className={`status-dot ${
              connState === "connected"
                ? "status-connected"
                : connState === "connecting"
                  ? "status-reconnecting"
                  : "status-disconnected"
            }`}
          />
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayTitle}
          </div>
        </div>
        <div className="row controls" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isHost && (
            <>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  const next = !micEnabled;
                  setMicEnabled(next);
                  sfuRef.current?.setMicEnabled(next);
                }}
              >
                {micEnabled ? "ミュート" : "ミュート解除"}
              </button>
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={isPublicState}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setIsPublicState(next);
                    await fetch("/api/room/set-public", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/x-www-form-urlencoded" },
                      body: new URLSearchParams({ room: roomName, isPublic: String(next) }),
                    });
                  }}
                />
                <span style={{ fontSize: 12 }}>一覧に公開</span>
              </label>
            </>
          )}
          <button type="button" className="btn secondary" onClick={() => void copyShareLink()}>
            リンクをコピー
          </button>
          <button type="button" className="btn secondary" onClick={() => void leaveRoom()}>
            {isHost ? "配信終了" : "退出"}
          </button>
        </div>
      </div>

      <div className="stack">
        <div style={{ flex: 1 }} className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>チャット</h3>
            <div className="row" style={{ gap: 8 }}>
              <div className="muted">視聴者数 {viewerCount}</div>
              <button type="button" className="btn secondary" onClick={() => setShowParticipants(true)}>
                視聴者 ({viewerCount + (isHost ? 1 : 0)})
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              disabled={isHost}
              onClick={async () => {
                if (isHost) return;
                setReactions((p) => ({ ...p, like: (p.like || 0) + 1 }));
                spawnFloat("like");
                if (wsRef.current) sendReaction(wsRef.current, "like");
                await fetch("/api/reaction/send", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ room: roomName, type: "like" }),
                }).catch(() => undefined);
              }}
            >
              👍 {reactions.like || 0}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={isHost}
              onClick={async () => {
                if (isHost) return;
                setReactions((p) => ({ ...p, gift: (p.gift || 0) + 1 }));
                spawnFloat("gift");
                if (wsRef.current) sendReaction(wsRef.current, "gift");
                await fetch("/api/reaction/send", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ room: roomName, type: "gift" }),
                }).catch(() => undefined);
              }}
            >
              🎁 {reactions.gift || 0}
            </button>
          </div>
          <Chat
            messages={messages}
            onSend={(text) => {
              if (wsRef.current) sendChat(wsRef.current, text);
              setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), from: userName, text, ts: Date.now(), self: true },
              ]);
            }}
          />
        </div>
      </div>

      {showParticipants && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          onClick={() => setShowParticipants(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 50,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "min(90vw, 720px)" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>視聴者</h3>
              <button type="button" className="btn secondary" onClick={() => setShowParticipants(false)}>
                閉じる
              </button>
            </div>
            <Participants
              participants={participants}
              selfIdentity={userId}
              isHost={isHost}
              onKick={(identity) => wsRef.current && sendKick(wsRef.current, identity)}
              onBan={async (identity) => {
                await fetch("/api/moderation/ban", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ room: roomName, identity }),
                });
                if (wsRef.current) sendKick(wsRef.current, identity);
              }}
            />
          </div>
        </div>
      )}

      <div className="reactions-overlay" style={{ position: "fixed", right: 24, bottom: 80, pointerEvents: "none" }}>
        {floats.map((f) => (
          <div key={f.id} className={`float ${f.type}`}>
            {f.type === "like" ? "👍" : "🎁"}
          </div>
        ))}
      </div>
    </div>
  );
}
