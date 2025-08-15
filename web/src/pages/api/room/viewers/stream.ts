import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/server/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const room = String(req.query.room || "");
  const withinSec = Number(req.query.withinSec ?? 60);
  const intervalMs = Math.max(1000, Math.min(10000, Number(req.query.interval ?? 2000)));
  if (!room) {
    res.status(400).json({ error: "room is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (data: any) => {
    if (closed) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      // ignore
    }
  };

  // Initial ping
  send({ ready: true });

  const tick = async () => {
    const since = new Date(Date.now() - Math.max(10, withinSec) * 1000);
    const roomRow = await prisma.room.findUnique({ where: { name: room } });
    const host = roomRow?.hostIdentity || null;
    const presences = await prisma.presence.findMany({
      where: { roomName: room, lastSeen: { gte: since } },
      select: { identity: true },
    });
    let count = 0;
    for (const p of presences) {
      if (host && p.identity === host) continue;
      count++;
    }
    send({ viewers: count });
  };

  const timer = setInterval(() => { void tick(); }, intervalMs);
  await tick();

  // Keep the connection open until client closes
  const wait = () => new Promise<void>((resolve) => {
    const onClose = () => resolve();
    req.on("close", onClose);
  });
  await wait();
  clearInterval(timer);
  try { res.end(); } catch {}
}

