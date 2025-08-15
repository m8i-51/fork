import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  const me = session ? ((session as any).userId || session.user?.email || "") : "";

  const room = (req.query.room as string) || "";
  if (!room) return res.status(400).json({ error: "room is required" });
  const row = await prisma.room.findUnique({ where: { name: room } });
  const hostIdentity = row?.hostIdentity || null;
  res.status(200).json({
    hasHost: !!hostIdentity,
    hostIdentity,
    isHost: hostIdentity ? hostIdentity === me : false,
    isPublic: row?.isPublic ?? true,
    displayName: row?.displayName ?? null,
  });
}
