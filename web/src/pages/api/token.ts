import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import jwt from "jsonwebtoken";
import { prisma } from "@/server/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { room, publish } = (req.method === "POST" ? req.body : req.query) as {
    room?: string;
    publish?: string | boolean;
  };

  if (!room || typeof room !== "string") {
    return res.status(400).json({ error: "room is required" });
  }

  let canPublishReq = String(publish ?? "true") !== "false";

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "server not configured" });
  }

  const identity = (session as any).userId || session.user?.email || "user";
  const name = session.user?.name || "guest";

  // Block banned identities from rejoining this room
  const banned = await prisma.ban.findUnique({ where: { roomName_identity: { roomName: room, identity } } });
  if (banned) return res.status(403).json({ error: "banned" });

  // If a host already exists and it's not me, force viewer
  const roomRow = await prisma.room.findUnique({ where: { name: room } });
  const existingHost = roomRow?.hostIdentity || undefined;
  if (canPublishReq && existingHost && existingHost !== identity) {
    canPublishReq = false;
  }

  // Record host on first publish token (when no existing or self)
  // and reset reactions when starting a fresh session.
  if (canPublishReq) {
    let didCreateOrAssignHost = false;
    if (!roomRow) {
      await prisma.room.create({ data: { name: room, hostIdentity: identity } });
      didCreateOrAssignHost = true;
    } else if (!roomRow.hostIdentity) {
      await prisma.room.update({ where: { name: room }, data: { hostIdentity: identity } });
      didCreateOrAssignHost = true;
    }

    // Determine if this should be treated as a fresh session.
    // Fresh if we just created/assigned host, or if the host has no recent presence (identity-scoped) ~30s.
    let isFreshSession = didCreateOrAssignHost;
    if (!isFreshSession) {
      const since = new Date(Date.now() - 30 * 1000);
      const recentHost = await prisma.presence.findFirst({ where: { roomName: room, identity: identity, lastSeen: { gte: since } } });
      if (!recentHost) isFreshSession = true;
    }
    if (isFreshSession) {
      await prisma.$transaction([
        prisma.reaction.deleteMany({ where: { roomName: room } }),
        prisma.reactionAggregate.deleteMany({ where: { roomName: room } }),
      ]);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    iss: apiKey,
    sub: identity,
    name,
    metadata: JSON.stringify({ role: canPublishReq ? "host" : "viewer" }),
    nbf: now - 10,
    exp: now + 60 * 60, // 1 hour
    video: {
      room,
      roomJoin: true,
      canPublish: !!canPublishReq,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const token = jwt.sign(payload, apiSecret, { algorithm: "HS256" });
  res.status(200).json({ token, canPublish: !!canPublishReq });
}
