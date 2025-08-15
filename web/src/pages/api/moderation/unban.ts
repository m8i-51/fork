import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  const { room, identity } = req.body as { room?: string; identity?: string };
  if (!room || !identity) return res.status(400).json({ error: "room and identity required" });

  const me = (session as any).userId || session.user?.email || "";
  const r = await prisma.room.findUnique({ where: { name: room } });
  if (r?.hostIdentity && r.hostIdentity !== me) return res.status(403).json({ error: "forbidden" });
  await prisma.ban.delete({ where: { roomName_identity: { roomName: room, identity } } }).catch(() => {});
  return res.status(200).json({ ok: true });
}
