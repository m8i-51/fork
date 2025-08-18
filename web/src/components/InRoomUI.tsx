import React, { useEffect, useMemo, useRef, useState } from "react";
import { RoomAudioRenderer, useRoomContext, TrackToggle } from "@livekit/components-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { Chat } from "@/components/Chat";
import { Participants } from "@/components/Participants";

export function InRoomUI({ onLeave, onRejoin, isHost, roomName }: { onLeave: () => void; onRejoin: () => void; isHost: boolean; roomName: string }) {
  const room = useRoomContext();
  const [audioReady, setAudioReady] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participantsCount, setParticipantsCount] = useState<number>(1);
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
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const meta = (room as any)?.localParticipant?.metadata ? JSON.parse((room as any).localParticipant.metadata) : {};
      if (meta?.role === "host" || meta?.role === "viewer") setRole(meta.role);
    } catch {}
  }, [room]);

  // Track participant count for header button
  useEffect(() => {
    if (!room) return;
    const compute = () => {
      try {
        const p: any = (room as any)?.participants;
        let n = 1; // include local participant
        if (p) {
          if (typeof p.size === 'number') n += p.size;
          else if (Array.isArray(p)) n += p.length;
        }
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
    setConnState((room as any)?.state as ConnectionState);
    const onState = () => setConnState(((room as any)?.state) as ConnectionState);
    (room as any)?.on?.(RoomEvent.ConnectionStateChanged, onState);
    // try auto-starting audio when connected; if blocked, show enable button
    const tryStart = async () => { try { await (room as any)?.startAudio?.(); setAudioReady(true); } catch { setAudioReady(false); } };
    if ((room as any)?.state === ConnectionState.Connected) { void tryStart(); }
    const onConnected = () => { if ((room as any)?.state === ConnectionState.Connected) void tryStart(); };
    (room as any)?.on?.(RoomEvent.Connected, onConnected as any);
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
    const sendHeartbeat = async () => { try { const body = new URLSearchParams({ room: rn }); await fetch("/api/presence/heartbeat", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); } catch {} };
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

    const onBeforeUnload = () => { const body = new URLSearchParams({ room: rn }); void fetch("/api/presence/leave", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); };
    window.addEventListener("beforeunload", onBeforeUnload);
    try { const saved = localStorage.getItem("audioinputDeviceId"); if (saved) { (room as any)?.switchActiveDevice?.("audioinput", saved); } } catch {}
    return () => {
      if (presenceTimer.current) clearInterval(presenceTimer.current);
      if (viewerTimer.current) clearInterval(viewerTimer.current);
      try { es?.close(); } catch {}
      window.removeEventListener("beforeunload", onBeforeUnload as any);
      const body = new URLSearchParams({ room: rn });
      void fetch("/api/presence/leave", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    };
  }, [room]);

  return (
    <div className="col" style={{ gap: 16 }}>
      <RoomAudioRenderer />
      {!audioReady && connState === ConnectionState.Connected && (
        <div className="card" style={{ background: '#fff7ed', borderColor: '#fb923c' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>ブラウザの制限で音声が停止しています。</div>
            <button className="btn" onClick={async () => { try { await (room as any)?.startAudio?.(); setAudioReady(true); } catch {} }}>音声を有効化</button>
          </div>
        </div>
      )}
      <div className="topbar" style={{ position: 'sticky', top: 8, zIndex: 10 }}>
        <div className="row" style={{ gap: 8, minWidth: 0 }}>
          <div className={`status-dot ${connState === ConnectionState.Connected ? 'status-connected' : connState === ConnectionState.Reconnecting ? 'status-reconnecting' : 'status-disconnected'}`} />
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomTitle}</div>
        </div>
        <div className="row controls" style={{ gap: 8, alignItems: 'center' }}>
          {(isHost || role === "host") && (
            <>
              <TrackToggle source={Track.Source.Microphone} />
              <button className="btn secondary" onClick={async () => { setShowDeviceModal(true); try { setDeviceLoading(true); setDeviceError(null); let list = await navigator.mediaDevices.enumerateDevices(); if (!list.some(d=>d.label)) { try { const s = await navigator.mediaDevices.getUserMedia({ audio:true }); s.getTracks().forEach(t=>t.stop()); list = await navigator.mediaDevices.enumerateDevices(); } catch {} } setDevices(list.filter(d=>d.kind==='audioinput') as MediaDeviceInfo[]); } catch { setDeviceError('デバイスの取得に失敗しました'); } finally { setDeviceLoading(false); } }}>マイク選択</button>
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={!!isPublicState} onChange={async (e) => { const next = e.target.checked; setIsPublicState(next); try { const body = new URLSearchParams({ room: (roomName || (room as any)?.name) as string, isPublic: String(next) }); await fetch('/api/room/set-public', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body }); } catch {} }} />
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
              <button className="btn secondary" onClick={() => setShowParticipants(true)}>視聴者 ({participantsCount})</button>
            </div>
          </div>
          {/* 反応ボタンをチャット上部に配置（視聴者のみ押下可） */}
          <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
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
          {/* 公開トグルはトップバーへ移動 */}
          <Chat room={room as any} />
        </div>
        {/* 視聴者はモーダルで表示してチャット幅を広く確保 */}
        {showParticipants && (
          <div role="dialog" aria-modal="true" className="modal-overlay" onClick={() => setShowParticipants(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
            <div className="card" onClick={(e)=>e.stopPropagation()} style={{ width: 'min(90vw, 720px)', maxHeight: '80vh', overflow: 'auto' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, textAlign: 'left' }}>視聴者</h3>
                <button className="btn secondary" onClick={() => setShowParticipants(false)}>閉じる</button>
              </div>
              <Participants room={room as any} isHost={isHost || role === 'host'} />
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

      <div className="reactions-overlay" style={{ position:'fixed', right:24, bottom:80, pointerEvents:'none' }}>
        {floats.map((f)=> (<div key={f.id} className={`float ${f.type}`}>{f.type==='like'?'👍':'🎁'}</div>))}
      </div>
    </div>
  );
}
