import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  name: string;
  displayName?: string | null;
  viewers: number;
};

function titleInitial(title: string): string {
  return title.slice(0, 1).toUpperCase() || "?";
}

export function LiveRoomCard({ name, displayName, viewers }: Props) {
  const title = displayName || name;

  return (
    <Card className="gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 shrink-0 border border-border">
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {titleInitial(title)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">@{name}</p>
            </div>
          </div>
          <Badge
            className="shrink-0 border-0 bg-live text-white hover:bg-live"
            aria-label="配信中"
          >
            <span className="mr-1.5 inline-block size-2 animate-pulse-live rounded-full bg-white" />
            LIVE
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>{viewers} 人が視聴中</span>
          </div>
          <Button size="sm" asChild>
            <Link to={`/room/${name}?publish=false`}>視聴する</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
