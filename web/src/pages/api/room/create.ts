import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { prisma } from "@/server/db";
import { isValidDisplayName, normalizeDisplayName } from "@/lib/validation";

function genSlug(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  const identity = (session as any).userId || session.user?.email || "";

  const { displayName } = (req.body || {}) as { displayName?: string };
  const dn = normalizeDisplayName(displayName ?? '');
  if (!isValidDisplayName(dn)) return res.status(400).json({ error: 'invalid_display_name' });

  // generate unique slug
  let slug = genSlug();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.room.findUnique({ where: { name: slug } });
    if (!exists) break;
    slug = genSlug();
  }

  const room = await prisma.room.create({
    data: {
      name: slug,
      displayName: dn,
      hostIdentity: identity,
      // isPublic default follows schema default
    },
  });

  res.status(200).json({ slug: room.name, room: { name: room.name, displayName: room.displayName } });
}
