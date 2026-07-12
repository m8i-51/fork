import { Participants } from "@/components/Participants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Participant = { identity: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: Participant[];
  selfIdentity: string;
  isHost: boolean;
  onKick: (identity: string) => void;
  onBan: (identity: string) => void;
};

export function ViewerDialog({
  open,
  onOpenChange,
  participants,
  selfIdentity,
  isHost,
  onKick,
  onBan,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>視聴者 ({participants.length})</DialogTitle>
        </DialogHeader>
        <Participants
          participants={participants}
          selfIdentity={selfIdentity}
          isHost={isHost}
          onKick={onKick}
          onBan={onBan}
        />
      </DialogContent>
    </Dialog>
  );
}
