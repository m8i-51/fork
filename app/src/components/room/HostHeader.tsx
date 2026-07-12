import { Users } from "lucide-react";
import type { ConnectionState } from "@/lib/sfu-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  displayTitle: string;
  viewerCount: number;
  connState: ConnectionState;
  isHost: boolean;
  hostName?: string;
};

function connLabel(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "接続済み";
    case "connecting":
      return "接続中";
    case "reconnecting":
      return "再接続中";
    case "disconnected":
      return "切断";
    case "idle":
      return "待機中";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function connDotClass(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "bg-green-500";
    case "connecting":
    case "reconnecting":
      return "bg-amber-500";
    case "disconnected":
    case "idle":
      return "bg-muted-foreground";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function HostHeader({ displayTitle, viewerCount, connState, isHost, hostName }: Props) {
  const initial = (hostName || displayTitle).slice(0, 1).toUpperCase() || "?";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-12 border-2 border-primary/30">
          <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{displayTitle}</h1>
            {isHost && (
              <Badge className="border-0 bg-live text-white" aria-label="配信中">
                <span className="mr-1 inline-block size-2 animate-pulse-live rounded-full bg-white" />
                LIVE
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", connDotClass(connState))} />
              {connLabel(connState)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {viewerCount} 人視聴中
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
