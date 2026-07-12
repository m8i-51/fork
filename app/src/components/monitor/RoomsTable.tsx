import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type RoomRow = {
  name: string;
  displayName: string | null;
  hostIdentity: string | null;
  isPublic: boolean;
  viewers: number;
};

type Props = {
  rooms: RoomRow[];
};

export function RoomsTable({ rooms }: Props) {
  return (
    <div className="rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Room</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Public</TableHead>
            <TableHead className="text-right">Viewers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                ルームがありません
              </TableCell>
            </TableRow>
          ) : (
            rooms.map((r) => (
              <TableRow key={r.name} className="hover:bg-muted/30">
                <TableCell className="font-medium">{r.displayName || r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.hostIdentity || "-"}</TableCell>
                <TableCell>
                  {r.isPublic ? (
                    <Badge variant="secondary">公開</Badge>
                  ) : (
                    <Badge variant="outline">非公開</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.viewers}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
