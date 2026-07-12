import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  isActive: boolean;
};

const BAR_COUNT = 12;

export function MediaStage({ isActive }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-6 py-8">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 origin-bottom rounded-full bg-primary/80",
              isActive ? "h-8 animate-visualizer" : "h-3 opacity-40",
            )}
            style={isActive ? { animationDelay: `${i * 0.08}s` } : undefined}
          />
        ))}
        {!isActive && (
          <span className="ml-4 text-sm text-muted-foreground">配信待機中</span>
        )}
      </div>

      <div
        className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 opacity-70"
        aria-label="映像配信エリア（近日公開）"
      >
        <div className="space-y-2 text-center">
          <Video className="mx-auto size-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">映像配信は近日公開</p>
          <Badge variant="secondary">Coming soon</Badge>
        </div>
      </div>
    </div>
  );
}
