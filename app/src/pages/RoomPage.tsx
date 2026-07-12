import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { InRoomUI } from "../components/InRoomUI";
import { api, fetchMe, type AuthUser } from "../lib/api";

export function RoomPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayTitle, setDisplayTitle] = useState(slug);
  const isHost = searchParams.get("publish") !== "false";

  useEffect(() => {
    void fetchMe().then((r) => {
      if (!r.authenticated) {
        window.location.href = "/api/auth/google";
        return;
      }
      setUser(r.user ?? null);
    });
    void api<{ displayName: string | null }>(`/api/room/info?room=${encodeURIComponent(slug)}`).then((info) => {
      if (info.displayName) setDisplayTitle(info.displayName);
    }).catch(() => undefined);
  }, [slug]);

  if (!user) {
    return (
      <div className="container">
        <p className="muted">認証中…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>fork</h1>
      <InRoomUI
        roomName={slug}
        displayTitle={displayTitle}
        isHost={isHost}
        userId={user.userId}
        userName={user.name}
        onLeave={() => void navigate("/")}
      />
    </div>
  );
}
