import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { devLogin, fetchMe, type AuthUser } from "@/lib/api";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTabsPlaceholder } from "@/components/lobby/CategoryTabsPlaceholder";
import { CreateRoomForm } from "@/components/lobby/CreateRoomForm";
import { LiveRoomCard } from "@/components/lobby/LiveRoomCard";
import { SearchBarPlaceholder } from "@/components/lobby/SearchBarPlaceholder";

type PublicRoom = { name: string; displayName?: string | null; viewers: number };

function RoomSkeleton() {
  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

export function LobbyPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);

  useEffect(() => {
    void fetchMe().then((res) => {
      setUser(res.authenticated ? (res.user ?? null) : null);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    const load = () => {
      void api<{ rooms: PublicRoom[] }>("/api/room/list?onlyLive=true")
        .then((j) => {
          setPublicRooms(j.rooms ?? []);
          setRoomsLoading(false);
        })
        .catch(() => setRoomsLoading(false));
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (authLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RoomSkeleton />
          <RoomSkeleton />
          <RoomSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">ライブを見つけよう</h1>
        <p className="mt-1 text-sm text-muted-foreground">音声ライブ配信 fork</p>
      </div>

      {!user && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">サインインして開始</CardTitle>
            <CardDescription>配信にはログインが必要です</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="/api/auth/google">Googleでサインイン</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/auth/twitter">Xでサインイン</a>
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void devLogin("Dev User").then(() =>
                  fetchMe().then((r) => setUser(r.user ?? null)),
                )
              }
            >
              Devログイン
            </Button>
          </CardContent>
        </Card>
      )}

      <SearchBarPlaceholder />
      <CategoryTabsPlaceholder />
      <CreateRoomForm disabled={!user} />

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" />
          <h2 className="font-semibold">公開中のルーム</h2>
        </div>

        {roomsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </div>
        ) : publicRooms.length === 0 ? (
          <Card className="py-12 text-center">
            <CardContent className="space-y-2">
              <Radio className="mx-auto size-10 text-muted-foreground/50" />
              <p className="font-medium">公開ルームはありません</p>
              <p className="text-sm text-muted-foreground">最初の配信者になりましょう</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((r) => (
              <LiveRoomCard
                key={r.name}
                name={r.name}
                displayName={r.displayName}
                viewers={r.viewers}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
