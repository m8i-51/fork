import { Hono } from "hono";
import type { AppVariables, Env } from "../env";
import { requireSession } from "../middleware/session";

type ModEnv = { Bindings: Env; Variables: AppVariables };

const moderation = new Hono<ModEnv>();

moderation.post("/ban", requireSession, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json()) as { room?: string; identity?: string };
  if (!body.room || !body.identity) return c.json({ error: "room and identity required" }, 400);

  const row = await c.env.DB.prepare(`SELECT host_identity FROM rooms WHERE name = ?`)
    .bind(body.room)
    .first<{ host_identity: string | null }>();
  if (row?.host_identity && row.host_identity !== user.userId) {
    return c.json({ error: "forbidden" }, 403);
  }

  await c.env.DB.prepare(
    `INSERT INTO bans (room_name, identity, created_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(room_name, identity) DO NOTHING`,
  )
    .bind(body.room, body.identity)
    .run();

  return c.json({ ok: true });
});

moderation.post("/unban", requireSession, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json()) as { room?: string; identity?: string };
  if (!body.room || !body.identity) return c.json({ error: "room and identity required" }, 400);

  const row = await c.env.DB.prepare(`SELECT host_identity FROM rooms WHERE name = ?`)
    .bind(body.room)
    .first<{ host_identity: string | null }>();
  if (row?.host_identity && row.host_identity !== user.userId) {
    return c.json({ error: "forbidden" }, 403);
  }

  await c.env.DB.prepare(`DELETE FROM bans WHERE room_name = ? AND identity = ?`)
    .bind(body.room, body.identity)
    .run();

  return c.json({ ok: true });
});

export { moderation };
