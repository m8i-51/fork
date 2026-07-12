import { Activity, Radio, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  total: number;
  roomCount: number;
  activeStreams: number;
};

export function StatsCards({ total, roomCount, activeStreams }: Props) {
  const stats = [
    { label: "合計視聴者", value: total, icon: Users },
    { label: "ルーム数", value: roomCount, icon: Radio },
    { label: "アクティブ配信", value: activeStreams, icon: Activity },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label} className="py-4">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-3xl font-bold tabular-nums">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
