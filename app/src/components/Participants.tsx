import { Button } from "@/components/ui/button";

type Participant = { identity: string; name: string };

type Props = {
  participants: Participant[];
  selfIdentity: string;
  isHost: boolean;
  onKick: (identity: string) => void;
  onBan: (identity: string) => void;
};

export function Participants({ participants, selfIdentity, isHost, onKick, onBan }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {participants.length === 0 && (
        <p className="text-sm text-muted-foreground">視聴者はいません。</p>
      )}
      {participants.map((p) => (
        <div
          key={p.identity}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
        >
          <div className="min-w-0 flex-1">
            <strong className="text-sm">{p.name || p.identity}</strong>
            {p.identity === selfIdentity ? (
              <span className="ml-2 text-xs text-muted-foreground">(自分)</span>
            ) : null}
          </div>
          {isHost && p.identity !== selfIdentity && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onKick(p.identity)}>
                キック
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onBan(p.identity)}
              >
                BAN
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
