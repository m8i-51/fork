import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

// Returns public rooms with approximate viewer counts based on recent presence heartbeats
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  // session is optional for browsing, but we'll still read it to tailor fields if needed
  await getServerSession(req, res, authOptions).catch(() => null);

  const onlyLive = String(req.query.onlyLive ?? "false") === "true";
  const withinSec = Number(req.query.withinSec ?? 60);
  const since = new Date(Date.now() - Math.max(10, withinSec) * 1000);

  // fetch public rooms
  const rooms = await prisma.room.findMany({ where: { isPublic: true } });
  if (rooms.length === 0) return res.status(200).json({ rooms: [] });

  const names = rooms.map((r) => r.name);
  // Count recent presences excluding the host identity from each room
  const presenceRows = await prisma.presence.findMany({
    where: { roomName: { in: names }, lastSeen: { gte: since } },
    select: { roomName: true, identity: true },
  });
  const hostByRoom = new Map<string, string | null>(rooms.map((r) => [r.name, r.hostIdentity || null]));
  const counts = new Map<string, number>();
  const hostOnline = new Map<string, boolean>();
  for (const p of presenceRows) {
    const host = hostByRoom.get(p.roomName);
    if (host && p.identity === host) {
      hostOnline.set(p.roomName, true);
      continue; // exclude host from viewer count
    }
    counts.set(p.roomName, (counts.get(p.roomName) || 0) + 1);
  }

  const payload = rooms
    .map((r) => ({ name: r.name, displayName: r.displayName, isPublic: r.isPublic, hostIdentity: r.hostIdentity, viewers: counts.get(r.name) || 0, _hostOnline: !!hostOnline.get(r.name) }))
    .filter((r) => (onlyLive ? (r.viewers > 0 || r._hostOnline) : true))
    .map(({ _hostOnline, ...rest }) => rest);

  res.status(200).json({ rooms: payload });
}
