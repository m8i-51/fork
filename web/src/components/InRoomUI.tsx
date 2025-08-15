import React, { useEffect, useMemo, useRef, useState } from "react";
import { RoomAudioRenderer, useRoomContext, MediaDeviceMenu, TrackToggle } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { Chat } from "@/components/Chat";
import { Participants } from "@/components/Participants";

export function InRoomUI({ onLeave, onRejoin, isHost, roomName }: { onLeave: () => void; onRejoin: () => void; isHost: boolean; roomName: string }) {
  const room = useRoomContext();
  const [role, setRole] = useState<"host" | "viewer" | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const viewerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPublicState, setIsPublicState] = useState<boolean | null>(null);
  const [roomTitle, setRoomTitle] = useState<string>(roomName);
  const leaveRoom = async () => {
    try { await (room as any)?.disconnect?.(); } catch {}
    onLeave();
  };
  const [connState, setConnState] = useState<ConnectionState | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, gift: 0 });
  const saveAudioInputDeviceId = (deviceId: string) => { try { localStorage.setItem("audioinputDeviceId", deviceId); } catch {} };
  const [bumpLike, setBumpLike] = useState<number>(0);
  const [bumpGift, setBumpGift] = useState<number>(0);
  const triggerBump = (type: 'like' | 'gift') => { if (type === 'like') setBumpLike(Date.now()); if (type === 'gift') setBumpGift(Date.now()); };
  const [floats, setFloats] = useState<{ id: string; type: 'like' | 'gift' }[]>([]);
  const spawnFloat = (type: 'like' | 'gift') => { const id = Math.random().toString(36).slice(2); setFloats((f) => [...f, { id, type }]); setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1200); };

  useEffect(() => {
    try {
      const meta = (room as any)?.localParticipant?.metadata ? JSON.parse((room as any).localParticipant.metadata) : {};
      if (meta?.role === "host" || meta?.role === "viewer") setRole(meta.role);
    } catch {}
  }, [room]);

  useEffect(() => {
    if (!room) return;
    setConnState((room as any)?.state as ConnectionState);
    const onState = () => setConnState(((room as any)?.state) as ConnectionState);
    (room as any)?.on?.(RoomEvent.ConnectionStateChanged, onState);
    return () => { (room as any)?.off?.(RoomEvent.ConnectionStateChanged, onState); };
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const onParticipantDisconnected = (participant: any) => {
      try {
        const meta = participant?.metadata ? JSON.parse(participant.metadata) : {};
        const isHostSender = meta?.role === "host";
        const iAmHost = isHost || role === "host";
        if (isHostSender && !iAmHost) {
          (room as any)?.disconnect?.().catch(() => {});
          alert("配信が終了しました");
          onLeave();
        }
      } catch {}
    };
    (room as any)?.on?.(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    return () => { (room as any)?.off?.(RoomEvent.ParticipantDisconnected, onParticipantDisconnected); };
  }, [room, isHost, role, onLeave]);

  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, participant?: any, _?: any, topic?: string) => {
      try {
        const text = new TextDecoder().decode(payload);
        const msg = JSON.parse(text);
        if (topic === "moderation") {
          let isHostSender = false;
          try { const meta = participant?.metadata ? JSON.parse(participant.metadata) : {}; isHostSender = meta?.role === "host"; } catch {}
          if (!isHostSender) return;
          if (msg?.type === "kick" && msg?.target && (room as any)?.localParticipant?.identity === msg.target) {
            (room as any)?.disconnect?.().catch(() => {});
            alert("ホストによって退室させられました");
          }
        } else if (topic === "reaction" && msg?.type) {
          setReactions((prev) => ({ ...prev, [msg.type]: (prev[msg.type] || 0) + 1 }));
          triggerBump(msg.type);
          spawnFloat(msg.type);
        }
      } catch {}
    };
    (room as any)?.on?.("dataReceived" as any, onData);
    return () => { (room as any)?.off?.("dataReceived" as any, onData); };
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const rn = (roomName || ((room as any)?.name as string)) as string;
    if (!rn) return;
    (async () => {
      try {
        const r = await fetch(`/api/room/info?room=${encodeURIComponent(rn)}`);
        if (r.ok) {
          const j = await r.json();
          if (typeof j.isPublic === "boolean") setIsPublicState(j.isPublic);
          if (j?.displayName) setRoomTitle(j.displayName);
          else setRoomTitle(rn);
        }
      } catch {}
    })();
    (async () => {
      try { const r = await fetch(`/api/reaction/summary?room=${encodeURIComponent(rn)}`); if (r.ok) { const j = await r.json(); if (j?.summary) setReactions((prev) => ({ ...prev, ...j.summary })); } } catch {}
    })();
    const sendHeartbeat = async () => { try { await fetch("/api/presence/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: rn }) }); } catch {} };
    void sendHeartbeat();
    presenceTimer.current = setInterval(sendHeartbeat, 20000);

    let es: EventSource | null = null;
    try {
      const q = new URLSearchParams({ room: rn, withinSec: String(60), interval: String(2000) }).toString();
      es = new EventSource(`/api/room/viewers/stream?${q}`);
      es.onmessage = (ev) => { try { const data = JSON.parse(ev.data); if (typeof data.viewers === "number") setViewerCount(data.viewers); } catch {} };
      es.onerror = () => { try { es?.close(); } catch {} };
    } catch {}

    const fetchViewers = async () => { if (es) return; try { const q = new URLSearchParams({ withinSec: String(60) }).toString(); const r = await fetch(`/api/room/list?${q}`); if (!r.ok) return; const j = await r.json(); const me = j.rooms?.find?.((x: any) => x.name === rn); if (me) setViewerCount(me.viewers || 0); } catch {} };
    void fetchViewers();
    viewerTimer.current = setInterval(fetchViewers, 5000);

    const onBeforeUnload = () => { void fetch("/api/presence/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: rn }) }); };
    window.addEventListener("beforeunload", onBeforeUnload);
    try { const saved = localStorage.getItem("audioinputDeviceId"); if (saved) { (room as any)?.switchActiveDevice?.("audioinput", saved); } } catch {}
    return () => {
      if (presenceTimer.current) clearInterval(presenceTimer.current);
      if (viewerTimer.current) clearInterval(viewerTimer.current);
      try { es?.close(); } catch {}
      window.removeEventListener("beforeunload", onBeforeUnload as any);
      void fetch("/api/presence/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: rn }) });
    };
  }, [room]);

  return (
    <div className="col" style={{ gap: 16 }}>
      <RoomAudioRenderer />
      <div className="topbar" style={{ position: 'sticky', top: 8, zIndex: 10 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <div className={`status-dot ${connState === ConnectionState.Connected ? 'status-connected' : connState === ConnectionState.Reconnecting ? 'status-reconnecting' : 'status-disconnected'}`} />
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomTitle}</div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <div className="muted">👁 <span className={`count ${bumpLike || bumpGift ? 'bump' : ''}`}>{viewerCount}</span></div>
          {(isHost || role === "host") && (
            <>
              <TrackToggle source={Track.Source.Microphone} />
              <MediaDeviceMenu kind="audioinput" title="マイク選択" onActiveDeviceChange={(_k, d) => { const id = d ?? 'default'; saveAudioInputDeviceId(id); try { (room as any)?.switchActiveDevice?.('audioinput', id); } catch {} }}>マイク選択</MediaDeviceMenu>
            </>
          )}
          <button className="btn secondary" onClick={leaveRoom}>退出</button>
        </div>
      </div>

      <div className="stack">
        <div style={{ flex: 1 }} className="card">
          <h3>チャット</h3>
          {/* 反応ボタンをチャット上部に配置（視聴者のみ押下可） */}
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <button className="btn secondary" disabled={isHost || role === "host"} title={(isHost || role === 'host') ? '配信者は押せません' : 'いいね'} onClick={async () => {
              if (isHost || role === 'host') return; setReactions((p)=>({ ...p, like: (p.like||0)+1 })); triggerBump('like'); spawnFloat('like');
              try { await (room as any)?.localParticipant?.publishData?.(new TextEncoder().encode(JSON.stringify({ type:'like' })), { reliable:false, topic:'reaction' } as any);} catch {}
              try { await fetch('/api/reaction/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ room: roomName || (room as any)?.name, type:'like' }) }); } catch {}
            }}>👍 {reactions.like || 0}</button>
            <button className="btn secondary" disabled={isHost || role === "host"} title={(isHost || role === 'host') ? '配信者は押せません' : 'ギフト'} onClick={async () => {
              if (isHost || role === 'host') return; setReactions((p)=>({ ...p, gift: (p.gift||0)+1 })); triggerBump('gift'); spawnFloat('gift');
              try { await (room as any)?.localParticipant?.publishData?.(new TextEncoder().encode(JSON.stringify({ type:'gift' })), { reliable:false, topic:'reaction' } as any);} catch {}
              try { await fetch('/api/reaction/send', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ room: roomName || (room as any)?.name, type:'gift' }) }); } catch {}
            }}>🎁 {reactions.gift || 0}</button>
          </div>
          {/* ホスト用の公開トグル */}
          {(isHost || role === "host") && (
            <label className="row" style={{ gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={!!isPublicState} onChange={async (e) => { const next = e.target.checked; setIsPublicState(next); try { await fetch('/api/room/set-public', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ room: roomName || (room as any)?.name, isPublic: next }) }); } catch {} }} />
              ルームを一覧に公開
            </label>
          )}
          <Chat room={room as any} />
        </div>
        <div style={{ minWidth: 360 }} className="card">
          <h3>参加者</h3>
          <Participants room={room as any} isHost={isHost || role === 'host'} />
        </div>
      </div>

      <div className="reactions-overlay" style={{ position:'fixed', right:24, bottom:80, pointerEvents:'none' }}>
        {floats.map((f)=> (<div key={f.id} className={`float ${f.type}`}>{f.type==='like'?'👍':'🎁'}</div>))}
      </div>
    </div>
  );
}
