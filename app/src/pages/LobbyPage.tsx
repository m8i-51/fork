import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isValidDisplayName, normalizeDisplayName } from "@fork/shared";
import { api, devLogin, fetchMe, logout, type AuthUser } from "../lib/api";

type PublicRoom = { name: string; displayName?: string | null; viewers: number };

export function LobbyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);

  useEffect(() => {
    void fetchMe().then((res) => {
      setUser(res.authenticated ? (res.user ?? null) : null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const load = () => {
      void api<{ rooms: PublicRoom[] }>("/api/room/list?onlyLive=true").then((j) => {
        setPublicRooms(j.rooms ?? []);
      }).catch(() => undefined);
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const createRoom = async () => {
    const dn = normalizeDisplayName(createName);
    if (!isValidDisplayName(dn)) {
      alert("表示名が不正です（1〜32文字、絵文字・特殊記号不可）");
      return;
    }
    const j = await api<{ slug: string }>("/api/room/create", {
      method: "POST",
      body: JSON.stringify({ displayName: dn }),
    });
    window.location.assign(`/room/${encodeURIComponent(j.slug)}?publish=true`);
  };

  if (loading) return <div className="container muted">読み込み中…</div>;

  return (
    <div className="container">
      <h1 style={{ fontSize: 28, marginBottom: 20, textAlign: "center" }}>fork</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        {user ? (
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>こんにちは、{user.name}</div>
            <button type="button" className="btn secondary" onClick={() => void logout().then(() => setUser(null))}>
              サインアウト
            </button>
          </div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            <div>サインインして開始</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <a className="btn" href="/api/auth/google">
                Googleでサインイン
              </a>
              <a className="btn" href="/api/auth/twitter">
                Xでサインイン
              </a>
              <button
                type="button"
                className="btn secondary"
                onClick={() => void devLogin("Dev User").then(() => fetchMe().then((r) => setUser(r.user ?? null)))}
              >
                Devログイン
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            className="input"
            placeholder="配信タイトル"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" className="btn" disabled={!user || !isValidDisplayName(createName)} onClick={() => void createRoom()}>
            配信を開始
          </button>
        </div>
        <div style={{ marginTop: 8 }} className="muted">
          公開中のルームから視聴するか、配信タイトルを入力して配信を開始できます。
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10 }}>公開中のルーム</div>
        {publicRooms.length === 0 && <div className="muted">現在、公開ルームはありません。</div>}
        <div className="grid">
          {publicRooms.map((r) => (
            <div key={r.name} className="card room-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>{r.displayName || r.name}</div>
                <span className="badge-live">
                  <span className="dot" style={{ color: "white" }} />
                  LIVE
                </span>
              </div>
              <div className="row-bottom">
                <div className="muted">視聴者数 {r.viewers}</div>
                <Link className="btn" to={`/room/${r.name}?publish=false`}>
                  視聴する
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <Link to="/admin/monitor">Monitor</Link>
      </div>
    </div>
  );
}
