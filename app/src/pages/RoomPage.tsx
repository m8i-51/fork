import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { InRoomUI } from "@/components/InRoomUI";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fetchMe, type AuthUser } from "@/lib/api";

export function RoomPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayTitle, setDisplayTitle] = useState(slug);
  const [authLoading, setAuthLoading] = useState(true);
  const isHost = searchParams.get("publish") !== "false";

  useEffect(() => {
    void fetchMe().then((r) => {
      if (!r.authenticated) {
        window.location.href = "/api/auth/google";
        return;
      }
      setUser(r.user ?? null);
      setAuthLoading(false);
    });
    void api<{ displayName: string | null }>(`/api/room/info?room=${encodeURIComponent(slug)}`)
      .then((info) => {
        if (info.displayName) setDisplayTitle(info.displayName);
      })
      .catch(() => undefined);
  }, [slug]);

  if (authLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <p className="text-center text-sm text-muted-foreground">認証中…</p>
      </div>
    );
  }

  return (
    <InRoomUI
      roomName={slug}
      displayTitle={displayTitle}
      isHost={isHost}
      userId={user.userId}
      userName={user.name}
      onLeave={() => void navigate("/")}
    />
  );
}
