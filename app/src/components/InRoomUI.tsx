import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, LogOut, Mic, MicOff, Users } from "lucide-react";
import { toast } from "sonner";
import { ChatPanel, type ChatMessage } from "@/components/room/ChatPanel";
import { GiftSheet } from "@/components/room/GiftSheet";
import { HostHeader } from "@/components/room/HostHeader";
import { MediaStage } from "@/components/room/MediaStage";
import { ReactionBar } from "@/components/room/ReactionBar";
import { ViewerDialog } from "@/components/room/ViewerDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { SfuAudioClient, type ConnectionState } from "@/lib/sfu-client";
import { connectRoomWs, sendChat, sendKick, sendReaction, type RoomWsHandlers } from "@/lib/room-ws";

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
  const [showGiftSheet, setShowGiftSheet] = useState(false);
  const [floats, setFloats] = useState<Array<{ id: string; type: "like" | "gift" }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioNeedsUnlock, setAudioNeedsUnlock] = useState(false);
  const [connecting, setConnecting] = useState(true);

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
        toast.info("配信が終了しました");
        void leaveRoom();
      },
      onKick: (target) => {
        if (target === userId) {
          toast.error("ホストによって退室させられました");
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
        const info = await api<{ isPublic: boolean }>(
          `/api/room/info?room=${encodeURIComponent(roomName)}`,
        );
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
        if (!cancelled) setConnecting(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "接続に失敗しました");
          setConnecting(false);
        }
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
    toast.success("リンクをコピーしました");
  };

  const sendReactionRequest = async (type: "like" | "gift") => {
    if (isHost) return;
    setReactions((p) => ({ ...p, [type]: (p[type] || 0) + 1 }));
    spawnFloat(type);
    if (wsRef.current) sendReaction(wsRef.current, type);
    await fetch("/api/reaction/send", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomName, type }),
    }).catch(() => undefined);
  };

  if (connecting) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <p className="text-center text-sm text-muted-foreground">接続中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {audioNeedsUnlock && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTitle>音声の再生</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>ブラウザの制限で音声が停止しています。</span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void audioRef.current?.play();
                setAudioNeedsUnlock(false);
              }}
            >
              音声を有効化
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <HostHeader
        displayTitle={displayTitle}
        viewerCount={viewerCount}
        connState={connState}
        isHost={isHost}
        hostName={isHost ? userName : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <MediaStage isActive={connState === "connected" && (isHost || viewerCount > 0)} />

          <ReactionBar
            reactions={reactions}
            isHost={isHost}
            onLike={() => void sendReactionRequest("like")}
            onGift={() => void sendReactionRequest("gift")}
            onOpenGiftSheet={() => setShowGiftSheet(true)}
          />

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            {isHost && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = !micEnabled;
                    setMicEnabled(next);
                    sfuRef.current?.setMicEnabled(next);
                  }}
                >
                  {micEnabled ? (
                    <>
                      <MicOff className="size-4" />
                      ミュート
                    </>
                  ) : (
                    <>
                      <Mic className="size-4" />
                      ミュート解除
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <Switch
                    id="public-toggle"
                    checked={isPublicState}
                    onCheckedChange={async (next) => {
                      setIsPublicState(next);
                      await fetch("/api/room/set-public", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({ room: roomName, isPublic: String(next) }),
                      });
                    }}
                  />
                  <Label htmlFor="public-toggle" className="text-sm">
                    一覧に公開
                  </Label>
                </div>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void copyShareLink()}>
              <Copy className="size-4" />
              リンクをコピー
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowParticipants(true)}
            >
              <Users className="size-4" />
              視聴者 ({viewerCount + (isHost ? 1 : 0)})
            </Button>
            <Button
              type="button"
              variant={isHost ? "destructive" : "outline"}
              size="sm"
              onClick={() => void leaveRoom()}
            >
              <LogOut className="size-4" />
              {isHost ? "配信終了" : "退出"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">チャット</h3>
          <ChatPanel
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

      <ViewerDialog
        open={showParticipants}
        onOpenChange={setShowParticipants}
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

      <GiftSheet open={showGiftSheet} onOpenChange={setShowGiftSheet} />

      <div className="pointer-events-none fixed right-6 bottom-20 z-40">
        {floats.map((f) => (
          <div key={f.id} className="animate-float-up text-2xl drop-shadow-md">
            {f.type === "like" ? "👍" : "🎁"}
          </div>
        ))}
      </div>
    </div>
  );
}
