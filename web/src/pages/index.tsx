import React, { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LiveKitRoom, ControlBar, RoomAudioRenderer, useRoomContext, TrackToggle } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { Chat } from "@/components/Chat";
import { Participants } from "@/components/Participants";
import { useRouter } from "next/router";
import { isValidDisplayName, normalizeDisplayName } from "@/lib/validation";

const WS_URL = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "";

function InRoomUI({ onLeave, onRejoin, isHost, roomName }: { onLeave: () => void; onRejoin: () => void; isHost: boolean; roomName: string }) {
  const room = useRoomContext();
  const [showParticipants, setShowParticipants] = useState(false);
  const [role, setRole] = useState<"host" | "viewer" | null>(null);
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const viewerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPublicState, setIsPublicState] = useState<boolean | null>(null);
  const leaveRoom = async () => {
    try {
      await room?.disconnect?.();
    } catch {}
    onLeave();
  };
  const [audioReady, setAudioReady] = useState(false);
  const [connState, setConnState] = useState<ConnectionState | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, gift: 0 });
  const [bumpLike, setBumpLike] = useState<number>(0);
  const [bumpGift, setBumpGift] = useState<number>(0);
  const triggerBump = (type: 'like' | 'gift') => {
    if (type === 'like') { setBumpLike(Date.now()); }
    if (type === 'gift') { setBumpGift(Date.now()); }
  };
  const [floats, setFloats] = useState<{ id: string; type: 'like' | 'gift' }[]>([]);
  const spawnFloat = (type: 'like' | 'gift') => {
    const id = Math.random().toString(36).slice(2);
    setFloats((f) => [...f, { id, type }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200);
  };
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const saveAudioInputDeviceId = (deviceId: string) => {
    try { localStorage.setItem("audioinputDeviceId", deviceId); } catch {}
  };
  useEffect(() => {
    try {
      const meta = room?.localParticipant?.metadata ? JSON.parse(room.localParticipant.metadata) : {};
      if (meta?.role === "host" || meta?.role === "viewer") setRole(meta.role);
    } catch {}
  }, [room]);

  useEffect(() => {
    if (!room) return;
    setConnState(room.state as ConnectionState);
    const onState = () => setConnState(room.state as ConnectionState);
    room.on(RoomEvent.ConnectionStateChanged, onState);
    // try auto-starting audio when connected; if blocked, show button
    const tryStart = async () => {
      try { await (room as any)?.startAudio?.(); setAudioReady(true); } catch { setAudioReady(false); }
    };
    if ((room as any)?.state === ConnectionState.Connected) { void tryStart(); }
    const onConnected = () => { if ((room as any)?.state === ConnectionState.Connected) void tryStart(); };
    room.on(RoomEvent.Connected, onConnected as any);
    return () => { room.off(RoomEvent.ConnectionStateChanged, onState); };
  }, [room]);
  // participants count for chat header
  useEffect(() => {
    if (!room) return;
    const compute = () => {
      try {
        const p: any = (room as any)?.participants; let n = 1;
        if (p) { if (typeof p.size === 'number') n += p.size; else if (Array.isArray(p)) n += p.length; }
        setParticipantsCount(n);
      } catch {}
    };
    compute();
    const onJoin = () => compute();
    const onLeaveP = () => compute();
    (room as any)?.on?.(RoomEvent.ParticipantConnected, onJoin);
    (room as any)?.on?.(RoomEvent.ParticipantDisconnected, onLeaveP);
    return () => {
      (room as any)?.off?.(RoomEvent.ParticipantConnected, onJoin);
      (room as any)?.off?.(RoomEvent.ParticipantDisconnected, onLeaveP);
    };
  }, [room]);
  useEffect(() => {
    if (!room) return;
    try {
      const saved = localStorage.getItem("audioinputDeviceId");
      if (saved) {
        (room as any)?.switchActiveDevice?.("audioinput", saved);
      }
    } catch {}
  }, [room]);
  useEffect(() => {
    if (!room) return;
    const onParticipantDisconnected = (participant: any) => {
      try {
        const meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
        const isHostSender = meta?.role === "host";
        const iAmHost = isHost || role === "host";
        if (isHostSender && !iAmHost) {
          room.disconnect().catch(() => {});
          alert("配信が終了しました");
          onLeave();
        }
      } catch {}
    };
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    };
  }, [room, isHost, role, onLeave]);
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, participant?: any, _?: any, topic?: string) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);
        if (topic === "moderation") {
          // 送信者がホストの場合のみ有効
          let isHostSender = false;
          try {
            const meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
            isHostSender = meta?.role === "host";
          } catch {}
          if (!isHostSender) return;
          if (msg?.type === "kick" && msg?.target && room.localParticipant?.identity === msg.target) {
            room.disconnect().catch(() => {});
            alert("ホストによって退室させられました");
          }
        } else if (topic === "reaction" && msg?.type) {
          setReactions((prev) => ({ ...prev, [msg.type]: (prev[msg.type] || 0) + 1 }));
          triggerBump(msg.type);
          spawnFloat(msg.type);
        }
      } catch {}
    };
    room.on("dataReceived" as any, onData);
    return () => {
      room.off("dataReceived" as any, onData);
    };
  }, [room]);

  // Presence heartbeat and viewer polling
  useEffect(() => {
    if (!room) return;
    const rn = (roomName || ((room as any)?.name as string)) as string;
    if (!rn) return;
    // fetch current visibility
    (async () => {
      try {
        const r = await fetch(`/api/room/info?room=${encodeURIComponent(rn)}`);
        if (r.ok) {
          const j = await r.json();
          if (typeof j.isPublic === "boolean") setIsPublicState(j.isPublic);
        }
      } catch {}
    })();
    // fetch reaction summary
    (async () => {
      try {
        const r = await fetch(`/api/reaction/summary?room=${encodeURIComponent(rn)}`);
        if (r.ok) {
          const j = await r.json();
          if (j?.summary) setReactions((prev) => ({ ...prev, ...j.summary }));
        }
      } catch {}
    })();
    const sendHeartbeat = async () => {
      try {
        const body = new URLSearchParams({ room: rn });
        await fetch("/api/presence/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
      } catch {}
    };
    void sendHeartbeat();
    presenceTimer.current = setInterval(sendHeartbeat, 20000);

    // Prefer SSE for real-time viewer count; fallback to polling
    let es: EventSource | null = null;
    try {
      const q = new URLSearchParams({ room: rn, withinSec: String(60), interval: String(2000) }).toString();
      es = new EventSource(`/api/room/viewers/stream?${q}`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (typeof data.viewers === "number") setViewerCount(data.viewers);
        } catch {}
      };
      es.onerror = () => {
        // will fall back to polling below
        try { es?.close(); } catch {}
      };
    } catch {}

    const fetchViewers = async () => {
      if (es) return; // if SSE active, skip polling
      try {
        const q = new URLSearchParams({ withinSec: String(60) }).toString();
        const r = await fetch(`/api/room/list?${q}`);
        if (!r.ok) return;
        const j = await r.json();
        const me = j.rooms?.find?.((x: any) => x.name === rn);
        if (me) setViewerCount(me.viewers || 0);
      } catch {}
    };
    void fetchViewers();
    viewerTimer.current = setInterval(fetchViewers, 5000);

    const leave = async () => {
      try {
        const body = new URLSearchParams({ room: rn });
        await fetch("/api/presence/leave", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      } catch {}
    };
    const onBeforeUnload = () => { void leave(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (presenceTimer.current) clearInterval(presenceTimer.current);
      if (viewerTimer.current) clearInterval(viewerTimer.current);
      try { es?.close(); } catch {}
      window.removeEventListener("beforeunload", onBeforeUnload);
      void leave();
    };
  }, [room]);
  const enableAudio = async () => {
    try {
      // ブラウザの自動再生制限に対応して、ユーザー操作でオーディオを開始
      await (room as any)?.startAudio?.();
      setAudioReady(true);
    } catch (e) {
      // 失敗してももう一度押せるようにする
      console.warn("startAudio failed", e);
    }
  };
  return (
    <div className="col" style={{ gap: 16 }}>
      <RoomAudioRenderer />
      {!audioReady && connState === ConnectionState.Connected && (
        <div className="card" style={{ background: '#fff7ed', borderColor: '#fb923c' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>ブラウザの制限で音声が停止しています。</div>
            <button className="btn" onClick={enableAudio}>音声を有効化</button>
          </div>
        </div>
      )}
      {connState === ConnectionState.Reconnecting && (
        <div className="card" style={{ background: "#eff6ff", borderColor: "#3b82f6" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>ネットワークが不安定です。再接続中…</div>
          </div>
        </div>
      )}
      {connState === ConnectionState.Disconnected && (
        <div className="card" style={{ background: "#fef2f2", borderColor: "#ef4444" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>接続が切れました。</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn secondary" onClick={leaveRoom}>退出</button>
              <button className="btn" onClick={onRejoin}>再入室</button>
            </div>
          </div>
        </div>
      )}
      {/* Top bar with room, status and viewer count */}
      <div className="topbar" style={{ position: 'sticky', top: 8, zIndex: 10 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <div className={`status-dot ${connState === ConnectionState.Connected ? 'status-connected' : connState === ConnectionState.Reconnecting ? 'status-reconnecting' : 'status-disconnected'}`} />
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
            {roomName || (room as any)?.name}
          </div>
        </div>
        <div className="row controls" style={{ gap: 8, alignItems: 'center' }}>
          {(isHost || role === "host") && (
            <>
              <TrackToggle source={Track.Source.Microphone} />
              <button className="btn secondary" onClick={async () => { setShowDeviceModal(true); try { setDeviceLoading(true); setDeviceError(null); let list = await navigator.mediaDevices.enumerateDevices(); if (!list.some(d=>d.label)) { try { const s = await navigator.mediaDevices.getUserMedia({ audio:true }); s.getTracks().forEach(t=>t.stop()); list = await navigator.mediaDevices.enumerateDevices(); } catch {} } setDevices(list.filter(d=>d.kind==='audioinput') as MediaDeviceInfo[]); } catch { setDeviceError('デバイスの取得に失敗しました'); } finally { setDeviceLoading(false); } }}>マイク選択</button>
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={!!isPublicState}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setIsPublicState(next);
                    try {
                      const body = new URLSearchParams({ room: (roomName || (room as any)?.name) as string, isPublic: String(next) });
                      await fetch("/api/room/set-public", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
                    } catch {}
                  }}
                />
                <span style={{ fontSize: 12 }}>一覧に公開</span>
              </label>
            </>
          )}
          <button className="btn secondary" onClick={leaveRoom}>{(isHost || role === 'host') ? '配信終了' : '退出'}</button>
        </div>
      </div>

      <div className="stack">
        <div style={{ flex: 1 }} className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, textAlign: 'left' }}>チャット</h3>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="muted">視聴者数 <span className={`count ${bumpLike || bumpGift ? 'bump' : ''}`}>{viewerCount}</span></div>
              <button className="btn secondary" onClick={() => setShowParticipants(true)}>視聴者 ({participantsCount})</button>
            </div>
          </div>
          <Chat room={room} />
        </div>
        <div style={{ minWidth: 300 }} className="card">
          <h3>操作</h3>
          <div style={{ marginBottom: 8, color: "#6b7280" }}>視聴者: {viewerCount}</div>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <button
              className="btn secondary"
              disabled={isHost || role === "host"}
              title={(isHost || role === "host") ? "配信者は押せません" : "いいね"}
              onClick={async () => {
                if (isHost || role === "host") return;
                // 楽観更新: 自分の反映を即時に
                setReactions((prev) => ({ ...prev, like: (prev.like || 0) + 1 }));
                triggerBump('like');
                spawnFloat('like');
                try {
                  const payload = { type: "like" };
                  await (room as any)?.localParticipant?.publishData?.(new TextEncoder().encode(JSON.stringify(payload)), { reliable: false, topic: "reaction" } as any);
                } catch {}
                try {
                  const body = new URLSearchParams({ room: (roomName || (room as any)?.name) as string, type: "like" });
                  await fetch("/api/reaction/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                  });
                } catch {}
              }}
            >👍 {reactions.like || 0}</button>
            <button
              className="btn secondary"
              disabled={isHost || role === "host"}
              title={(isHost || role === "host") ? "配信者は押せません" : "ギフト"}
              onClick={async () => {
                if (isHost || role === "host") return;
                // 楽観更新
                setReactions((prev) => ({ ...prev, gift: (prev.gift || 0) + 1 }));
                triggerBump('gift');
                spawnFloat('gift');
                try {
                  const payload = { type: "gift" };
                  await (room as any)?.localParticipant?.publishData?.(new TextEncoder().encode(JSON.stringify(payload)), { reliable: false, topic: "reaction" } as any);
                } catch {}
                try {
                  const body = new URLSearchParams({ room: (roomName || (room as any)?.name) as string, type: "gift" });
                  await fetch("/api/reaction/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                  });
                } catch {}
              }}
            >🎁 {reactions.gift || 0}</button>
          </div>
          {/* 公開トグルはトップバーに移動 */}
          {/* controls moved to top bar */}
        </div>
        {showParticipants && (
          <div role="dialog" aria-modal="true" className="modal-overlay" onClick={() => setShowParticipants(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
            <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width: 'min(90vw, 720px)', maxHeight: '80vh', overflow: 'auto' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, textAlign: 'left' }}>視聴者</h3>
                <button className="btn secondary" onClick={() => setShowParticipants(false)}>閉じる</button>
              </div>
              <Participants room={room} isHost={isHost || role === "host"} />
            </div>
          </div>
        )}
        {showDeviceModal && (
          <div role="dialog" aria-modal="true" className="modal-overlay" onClick={() => setShowDeviceModal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:60 }}>
            <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width: 'min(90vw, 560px)', maxHeight: '80vh', overflow:'auto' }}>
              <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
                <h3 style={{ margin:0, textAlign:'left' }}>マイク選択</h3>
                <button className="btn secondary" onClick={() => setShowDeviceModal(false)}>閉じる</button>
              </div>
              {deviceError && <div className="card" style={{ borderColor:'var(--danger)', color:'var(--danger)', marginBottom:8 }}>{deviceError}</div>}
              {deviceLoading ? (
                <div className="muted">読み込み中…</div>
              ) : (
                <div className="col" style={{ gap: 8 }}>
                  {devices.length === 0 && <div className="muted">マイクが見つかりませんでした。</div>}
                  {devices.map((d) => (
                    <button key={d.deviceId} className="btn secondary" style={{ justifyContent:'space-between' }} onClick={async () => {
                      const id = d.deviceId || 'default';
                      saveAudioInputDeviceId(id);
                      try { await (room as any)?.switchActiveDevice?.('audioinput', id); } catch {}
                      setShowDeviceModal(false);
                    }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>{d.label || 'マイク'}</span>
                      <span className="muted" style={{ fontSize:12 }}>選択</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* reaction float overlay */}
      <div className="reactions-overlay" style={{ position: 'fixed', right: 24, bottom: 80, pointerEvents: 'none' }}>
        {floats.map((f) => (
          <div key={f.id} className={`float ${f.type}`}>{f.type === 'like' ? '👍' : '🎁'}</div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [roomName, setRoomName] = useState("");
  const [createName, setCreateName] = useState("");
  const [asHost, setAsHost] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<{ name: string; viewers: number }[]>([]);
  const publicRoomsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldAutoJoin = useRef(false);
  const [roomInfo, setRoomInfo] = useState<{ hasHost: boolean; hostIdentity: string | null; isHost: boolean } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const tokenRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPublishRef = useRef<boolean>(false);
  const clearTimers = () => {
    if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
    tokenRefreshTimer.current = null;
  };

  const decodeJwtExp = (tok: string): number | null => {
    try {
      const parts = tok.split(".");
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = typeof window === "undefined" ? Buffer.from(base64, "base64").toString("utf-8") : atob(base64);
      const payload = JSON.parse(json);
      return typeof payload.exp === "number" ? payload.exp : null;
    } catch {
      return null;
    }
  };

  const userName = session?.user?.name || "";

  const join = async (publishOverride?: boolean, roomOverride?: string) => {
    const room = (roomOverride ?? roomName).trim();
    if (!room) return alert("Room名を入力してください");
    setJoinError(null);
    const publishFlag = publishOverride ?? asHost;
    const q = new URLSearchParams({ room, publish: String(publishFlag) }).toString();
    let res: Response;
    try {
      res = await fetch(`/api/token?${q}`);
    } catch (e) {
      setJoinError("サーバに接続できません。LiveKit/APIの起動を確認してください。");
      return;
    }
    if (!res.ok) {
      if (res.status === 401) {
        setJoinError("サインインが必要です。");
        try {
          if (typeof window !== 'undefined') {
            await signIn(undefined, { callbackUrl: window.location.href });
          }
        } catch {}
      } else if (res.status === 403) {
        setJoinError("このルームからBANされています。");
      } else {
        setJoinError(`トークン取得に失敗しました（${res.status}）。`);
      }
      return;
    }
    const data = await res.json();
    if (data && typeof data.canPublish === "boolean" && !data.canPublish) {
      setAsHost(false);
    }
    setToken(data.token);
    lastPublishRef.current = !!(data.canPublish ?? publishFlag);
    const exp = decodeJwtExp(data.token);
    if (exp) {
      const now = Math.floor(Date.now() / 1000);
      const lead = 60; // refresh 60s before expiry
      let ms = (exp - now - lead) * 1000;
      if (ms < 30000) ms = 30000; // minimum 30s
      if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
      tokenRefreshTimer.current = setTimeout(() => { void refreshToken(); }, ms);
    }
  };

  const leave = () => { setToken(null); clearTimers(); };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    const p = params.get("publish");
    if (r) setRoomName(r);
    if (p === "false") setAsHost(false);
    if (r) shouldAutoJoin.current = true;
  }, []);

  // Poll public rooms list
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const r = await fetch("/api/room/list?onlyLive=true&withinSec=60");
        if (!r.ok) return;
        const j = await r.json();
        const arr = (j.rooms || []).map((x: any) => ({ name: x.name, viewers: x.viewers, displayName: x.displayName }));
        arr.sort((a: any, b: any) => (b.viewers || 0) - (a.viewers || 0));
        setPublicRooms(arr);
      } catch {}
    };
    void fetchRooms();
    if (publicRoomsTimer.current) clearInterval(publicRoomsTimer.current);
    publicRoomsTimer.current = setInterval(fetchRooms, 15000);
    return () => { if (publicRoomsTimer.current) clearInterval(publicRoomsTimer.current); };
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      const room = roomName.trim();
      if (!room) return setRoomInfo(null);
      try {
        const r = await fetch(`/api/room/info?room=${encodeURIComponent(room)}`);
        if (r.ok) {
          const j = await r.json();
          setRoomInfo(j);
          // 既にホストがいるなら視聴者モードにする
          const me = (session as any)?.userId || session?.user?.email;
          if (j.hasHost && j.hostIdentity && j.hostIdentity !== me) {
            setAsHost(false);
          }
        } else {
          setRoomInfo(null);
        }
      } catch {
        setRoomInfo(null);
      }
    };
    fetchInfo();
  }, [roomName, status]);

  // 自動入室は行わず、ユーザーのクリックで入室（自動再生制限対策）

  // 共有リンクはルームページ側に配置します

  const refreshToken = async () => {
    const room = roomName.trim();
    if (!room) return;
    try {
      const q = new URLSearchParams({ room, publish: String(lastPublishRef.current) }).toString();
      const r = await fetch(`/api/token?${q}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j?.token) {
        setToken(j.token);
        lastPublishRef.current = !!(j.canPublish ?? lastPublishRef.current);
        const exp = decodeJwtExp(j.token);
        if (exp) {
          const now = Math.floor(Date.now() / 1000);
          const lead = 60;
          let ms = (exp - now - lead) * 1000;
          if (ms < 30000) ms = 30000;
          if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
          tokenRefreshTimer.current = setTimeout(() => { void refreshToken(); }, ms);
        }
      }
    } catch {}
  };

  return (
    <div className="container">
      <h1 style={{ fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>fork</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        {status !== "authenticated" ? (
          <div className="row" style={{ justifyContent: "space-between", flexWrap: 'wrap', gap: 8 }}>
            <div>サインインして開始</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => signIn("google", { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined })}>Googleでサインイン</button>
              <button className="btn" onClick={() => signIn("twitter", { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined })}>Xでサインイン</button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: "space-between", flexWrap: 'wrap', gap: 8 }}>
            <div>こんにちは、{userName}</div>
            <button className="btn secondary" onClick={() => signOut()}>サインアウト</button>
          </div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
          <input className="input" placeholder="配信タイトル" required value={createName} onChange={(e) => setCreateName(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn" disabled={status !== "authenticated" || !isValidDisplayName(createName)} onClick={async () => {
            const dn = normalizeDisplayName(createName);
            if (!isValidDisplayName(dn)) { alert('表示名が不正です（1〜32文字、絵文字・特殊記号不可）'); return; }
            try {
              const body = new URLSearchParams({ displayName: dn });
              const r = await fetch('/api/room/create', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
              if (!r.ok) { alert('ルーム作成に失敗しました'); return; }
              const j = await r.json();
              window.location.assign(`/room/${encodeURIComponent(j.slug)}?publish=true`);
            } catch {
              alert('ルーム作成に失敗しました');
            }
          }}>配信を開始</button>
        </div>
        {!isValidDisplayName(createName) && createName.length > 0 && (
          <div style={{ marginTop: 4, color: 'var(--danger)', fontSize: 12 }}>
            1〜32文字、絵文字・&lt; &gt; " ' ` などの特殊記号は使用できません。
          </div>
        )}
        <div style={{ marginTop: 8 }} className="muted">公開中のルームから視聴するか、配信タイトルを入力して配信を開始できます。</div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>公開中のルーム</div>
            {publicRooms.length === 0 && <div className="muted">現在、公開ルームはありません。</div>}
            {publicRooms.length > 0 && (
              <div className="grid">
                {publicRooms.map((r) => (
                  <div key={r.name} className="card room-card">
                    <div className="row" style={{ justifyContent: "space-between", flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{(r as any).displayName || r.name}</div>
                      <span className="badge-live"><span className="dot" style={{ color: 'white' }}></span>LIVE</span>
                    </div>
                    <div className="row-bottom">
                      <div className="muted">視聴者数 {r.viewers}</div>
                      <button className="btn" onClick={() => { window.location.assign(`/room/${encodeURIComponent(r.name)}?publish=false`); }}>視聴する</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* ルーム画面は /room/[name] に移動しました */}
      {!WS_URL && (
        <p style={{ color: "#b91c1c" }}>
          NEXT_PUBLIC_LIVEKIT_WS_URL が未設定です。`.env.local`を確認してください。
        </p>
      )}
    </div>
  );
}
