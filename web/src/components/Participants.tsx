import React, { useEffect, useMemo, useState } from "react";
import { Room, RoomEvent, RemoteParticipant, Track, RemoteTrackPublication } from "livekit-client";

type Props = {
  room: Room | undefined;
  isHost: boolean;
};

export function Participants({ room, isHost }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!room) return;
    const rerender = () => setTick((n) => n + 1);
    room.on(RoomEvent.ParticipantConnected, rerender);
    room.on(RoomEvent.ParticipantDisconnected, rerender);
    room.on(RoomEvent.ActiveSpeakersChanged, rerender);
    return () => {
      room.off(RoomEvent.ParticipantConnected, rerender);
      room.off(RoomEvent.ParticipantDisconnected, rerender);
      room.off(RoomEvent.ActiveSpeakersChanged, rerender);
    };
  }, [room]);

  const participants = useMemo(() => {
    if (!room) return [] as (RemoteParticipant | any)[];
    const arr: (RemoteParticipant | any)[] = [];
    // local first
    if (room.localParticipant) arr.push(room.localParticipant as any);
    const anyRoom = room as any;
    const maps: (Map<string, RemoteParticipant> | undefined)[] = [
      anyRoom.participants,
      anyRoom.remoteParticipants,
    ];
    for (const m of maps) {
      if (m && typeof (m as any).forEach === "function") {
        (m as Map<string, RemoteParticipant>).forEach((p) => {
          // avoid duplicating local participant
          if (!(p as any).isLocal) arr.push(p);
        });
        break;
      }
    }
    return arr;
  }, [room, (room as any)?.participants?.size, (room as any)?.remoteParticipants?.size]);

  const sendKick = async (p: RemoteParticipant | any) => {
    if (!room) return;
    try {
      const payload = new TextEncoder().encode(
        JSON.stringify({ type: "kick", target: p.identity })
      );
      await room.localParticipant.publishData(payload, { reliable: true, topic: "moderation" });
      alert(`${p.name || p.identity} に退室を要求しました（MVPのソフトキック）`);
    } catch {}
  };

  const banAndKick = async (p: RemoteParticipant | any) => {
    if (!room) return;
    try {
      await fetch("/api/moderation/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: room.name, identity: p.identity }),
      });
      await sendKick(p);
    } catch (e) {
      console.warn("ban failed", e);
    }
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      {participants.map((p: any) => {
        const isLocal = p.isLocal ?? false;
        const speaking = !!p.isSpeaking;
        return (
          <div key={p.sid} className="row" style={{ justifyContent: "space-between", flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{p.name || p.identity}</strong>
              {isLocal ? <span style={{ marginLeft: 6, color: "#6b7280" }}>(自分)</span> : null}
              {speaking ? <span style={{ marginLeft: 8, color: "#059669" }}>発話中</span> : null}
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {!isLocal && (
                <>
                  {isHost && (
                    <>
                      <button className="btn" onClick={() => sendKick(p)}>キック</button>
                      <button className="btn" onClick={() => banAndKick(p)}>BAN+キック</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
