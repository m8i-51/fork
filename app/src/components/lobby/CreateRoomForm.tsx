import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { isValidDisplayName, normalizeDisplayName } from "@fork/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  disabled?: boolean;
};

export function CreateRoomForm({ disabled }: Props) {
  const navigate = useNavigate();
  const [createName, setCreateName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createRoom = async () => {
    const dn = normalizeDisplayName(createName);
    if (!isValidDisplayName(dn)) {
      toast.error("表示名が不正です（1〜32文字、絵文字・特殊記号不可）");
      return;
    }
    setSubmitting(true);
    try {
      const j = await api<{ slug: string }>("/api/room/create", {
        method: "POST",
        body: JSON.stringify({ displayName: dn }),
      });
      navigate(`/room/${encodeURIComponent(j.slug)}?publish=true`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ルーム作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="size-4 text-primary" />
          配信を開始
        </CardTitle>
        <CardDescription>配信タイトルを入力してライブを始めましょう</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="配信タイトル"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            disabled={disabled || submitting}
            className="h-11 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !disabled) void createRoom();
            }}
          />
          <Button
            type="button"
            disabled={disabled || submitting || !isValidDisplayName(createName)}
            onClick={() => void createRoom()}
            className="h-11 shrink-0"
          >
            {submitting ? "作成中…" : "配信を開始"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
