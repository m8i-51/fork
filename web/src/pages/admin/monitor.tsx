import React, { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";

type RoomRow = { name: string; viewers: number; isPublic?: boolean; hostIdentity?: string | null };

export default function MonitorPage() {
  const { status } = useSession();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchRooms = async () => {
      try {
        const r = await fetch("/api/room/list?onlyLive=false&withinSec=60");
        if (!r.ok) return;
        const j = await r.json();
        setRooms((j.rooms || []).map((x: any) => ({ name: x.name, viewers: x.viewers, isPublic: x.isPublic, hostIdentity: x.hostIdentity })));
      } catch {}
    };
    void fetchRooms();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(fetchRooms, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [status]);

  if (status !== "authenticated") {
    return (
      <div className="container">
        <h1>Monitor</h1>
        <p>サインインが必要です。</p>
        <button className="btn" onClick={() => signIn()}>サインイン</button>
      </div>
    );
  }

  const total = rooms.reduce((a, b) => a + (b.viewers || 0), 0);

  return (
    <div className="container">
      <h1>Monitor</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div>合計視聴者: {total}</div>
        <div>ルーム数: {rooms.length}</div>
      </div>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Rooms (last 60s)</div>
        {rooms.length === 0 && <div className="muted">データがありません。</div>}
        {rooms.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Room</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Host</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>Public</th>
                  <th style={{ padding: '8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Viewers</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{r.name}</td>
                    <td style={{ padding: '8px' }}>{r.hostIdentity || '-'}</td>
                    <td style={{ padding: '8px' }}>{String(!!r.isPublic)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>👁 {r.viewers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
