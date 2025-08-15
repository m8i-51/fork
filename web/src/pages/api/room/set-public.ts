import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

// Host-only: toggle a room's public visibility
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).setHeader("Allow", "POST, OPTIONS").json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  const identity = (session as any).userId || session.user?.email || "";

  const { room, isPublic: isPublicRaw } = req.body as { room?: string; isPublic?: boolean | string };
  if (!room) return res.status(400).json({ error: "invalid_params" });
  const isPublic = typeof isPublicRaw === 'string' ? (isPublicRaw === 'true') : !!isPublicRaw;

  const row = await prisma.room.findUnique({ where: { name: room } });
  if (!row) return res.status(404).json({ error: "room_not_found" });
  if (row.hostIdentity && row.hostIdentity !== identity) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.room.update({ where: { name: room }, data: { isPublic } });
  res.status(200).json({ ok: true, isPublic: updated.isPublic });
}
