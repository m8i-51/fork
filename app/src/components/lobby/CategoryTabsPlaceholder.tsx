import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CATEGORIES = ["すべて", "音楽", "トーク"] as const;

export function CategoryTabsPlaceholder() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Tabs defaultValue="すべて">
            <TabsList className="w-full justify-start">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} disabled className="flex-1 sm:flex-none">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </TooltipTrigger>
      <TooltipContent>カテゴリフィルターは近日公開予定です</TooltipContent>
    </Tooltip>
  );
}
