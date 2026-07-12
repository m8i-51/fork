import { useEffect, useState } from "react";
import { BarChart3, ShieldAlert } from "lucide-react";
import { AppShellLink } from "@/components/layout/AppShell";
import { RoomsTable } from "@/components/monitor/RoomsTable";
import { StatsCards } from "@/components/monitor/StatsCards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, fetchMe } from "@/lib/api";

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
      void api<{ rooms: RoomRow[]; total: number }>("/api/admin/rooms")
        .then((data) => {
          setRooms(data.rooms);
          setTotal(data.total);
        })
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(t);
  }, [authorized]);

  if (authorized === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <Card className="mx-auto max-w-md py-8 text-center">
        <CardHeader>
          <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
          <CardTitle>管理者権限が必要です</CardTitle>
          <CardDescription>Monitor ページは管理者のみアクセスできます</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild>
            <a href="/api/auth/google">サインイン</a>
          </Button>
          <AppShellLink to="/">ロビーへ戻る</AppShellLink>
        </CardContent>
      </Card>
    );
  }

  const activeStreams = rooms.filter((r) => r.hostIdentity).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monitor</h1>
        <p className="text-sm text-muted-foreground">リアルタイム運用ダッシュボード</p>
      </div>

      <StatsCards total={total} roomCount={rooms.length} activeStreams={activeStreams} />
      <RoomsTable rooms={rooms} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" disabled className="gap-2">
            <BarChart3 className="size-4" />
            帯域モニター
          </Button>
        </TooltipTrigger>
        <TooltipContent>SFU egress 概算表示は近日公開予定です</TooltipContent>
      </Tooltip>

      <AppShellLink to="/">ロビーへ戻る</AppShellLink>
    </div>
  );
}
