import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fetchMe } from "../lib/api";

type RoomRow = {
  name: string;
  displayName: string | null;
  hostIdentity: string | null;
  isPublic: boolean;
  viewers: number;
};

export function MonitorPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void fetchMe().then(async (me) => {
      if (!me.authenticated) {
        setAuthorized(false);
        return;
      }
      try {
        const data = await api<{ rooms: RoomRow[]; total: number }>("/api/admin/rooms");
        setRooms(data.rooms);
        setTotal(data.total);
        setAuthorized(true);
      } catch {
        setAuthorized(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const t = setInterval(() => {
      void api<{ rooms: RoomRow[]; total: number }>("/api/admin/rooms").then((data) => {
        setRooms(data.rooms);
        setTotal(data.total);
      }).catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [authorized]);

  if (authorized === null) return <div className="container muted">読み込み中…</div>;

  if (!authorized) {
    return (
      <div className="container">
        <h1>Monitor</h1>
        <p>サインインまたは管理者権限が必要です。</p>
        <a className="btn" href="/api/auth/google">
          サインイン
        </a>
        <p style={{ marginTop: 16 }}>
          <Link to="/">ロビーへ</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Monitor</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div>合計視聴者: {total}</div>
        <div>ルーム数: {rooms.length}</div>
      </div>
      <div className="card">
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Room</th>
              <th>Host</th>
              <th>Public</th>
              <th>Viewers</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.name}>
                <td>{r.displayName || r.name}</td>
                <td>{r.hostIdentity || "-"}</td>
                <td>{String(r.isPublic)}</td>
                <td>{r.viewers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16 }}>
        <Link to="/">ロビーへ</Link>
      </p>
    </div>
  );
}
