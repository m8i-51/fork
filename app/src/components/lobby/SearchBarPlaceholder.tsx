import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SearchBarPlaceholder() {
  return (
    <div className="space-y-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              disabled
              placeholder="ルームを検索..."
              className="h-11 pl-10 opacity-60"
              aria-label="ルーム検索（近日公開）"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>検索機能は近日公開予定です</TooltipContent>
      </Tooltip>
      <Badge variant="secondary" className="text-xs">
        近日公開
      </Badge>
    </div>
  );
}
