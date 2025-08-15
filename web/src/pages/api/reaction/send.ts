import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

const ALLOWED_TYPES = new Set(["like", "gift"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const identity = (session as any).userId || session.user?.email || "";
  const { room, type } = req.body as { room?: string; type?: string };
  if (!room || !type || !ALLOWED_TYPES.has(type)) return res.status(400).json({ error: "invalid_params" });

  // Disallow host reacting in their own room
  const roomRow = await prisma.room.findUnique({ where: { name: room } });
  if (roomRow?.hostIdentity && roomRow.hostIdentity === identity) {
    return res.status(403).json({ error: "host_cannot_react" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.reaction.create({ data: { roomName: room, identity, type } });
    await tx.reactionAggregate.upsert({
      where: { roomName_type: { roomName: room, type } },
      update: { count: { increment: 1 } },
      create: { roomName: room, type, count: 1 },
    });
  });

  const agg = await prisma.reactionAggregate.findMany({ where: { roomName: room } });
  const summary: Record<string, number> = {};
  for (const a of agg) summary[a.type] = a.count;
  res.status(200).json({ ok: true, summary });
}
