import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const room = String(req.query.room || "");
  if (!room) return res.status(400).json({ error: "room is required" });
  const agg = await prisma.reactionAggregate.findMany({ where: { roomName: room } });
  const summary: Record<string, number> = {};
  for (const a of agg) summary[a.type] = a.count;
  res.status(200).json({ summary });
}

