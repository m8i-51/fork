import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PLACEHOLDER_GIFTS = ["🌟", "💎", "🎵", "🔥", "✨", "🎁"];

export function GiftSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Gift className="size-5 text-gift" />
            ギフト
          </SheetTitle>
          <SheetDescription>ギフト機能は近日公開予定です</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex justify-center">
          <Badge variant="secondary">Coming soon</Badge>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PLACEHOLDER_GIFTS.map((emoji) => (
            <div
              key={emoji}
              className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-2xl opacity-50"
              aria-hidden
            >
              {emoji}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
