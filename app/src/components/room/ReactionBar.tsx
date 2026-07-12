import { Gift, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  reactions: Record<string, number>;
  isHost: boolean;
  onLike: () => void;
  onGift: () => void;
  onOpenGiftSheet: () => void;
};

export function ReactionBar({ reactions, isHost, onLike, onGift, onOpenGiftSheet }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isHost}
        onClick={onLike}
        className="gap-1.5"
      >
        <ThumbsUp className="size-4" />
        {reactions.like || 0}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isHost}
        onClick={onGift}
        className="gap-1.5 border-gift/40 text-gift hover:bg-gift/10"
      >
        <Gift className="size-4" />
        {reactions.gift || 0}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isHost}
        onClick={onOpenGiftSheet}
        className="gap-1.5"
      >
        <Gift className="size-4" />
        ギフト+
      </Button>
    </div>
  );
}
