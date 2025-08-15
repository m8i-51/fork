import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const { room, name } = req.body as { room?: string; name?: string };
  if (!room) return res.status(400).json({ error: "room required" });
  const identity = (session as any).userId || session.user?.email || "";
  await prisma.presence.upsert({
    where: { roomName_identity: { roomName: room, identity } },
    update: { lastSeen: new Date(), name: name || session.user?.name || null },
    create: { roomName: room, identity, name: name || session.user?.name || null },
  });
  res.status(200).json({ ok: true });
}

