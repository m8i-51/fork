import { Hono } from "hono";
import type { AppVariables, Env } from "../env";
import { requireSession } from "../middleware/session";
import { checkRateLimit } from "../lib/rate-limit";

type ReactionEnv = { Bindings: Env; Variables: AppVariables };

const ALLOWED = new Set(["like", "gift"]);

const reaction = new Hono<ReactionEnv>();

reaction.get("/summary", async (c) => {
  const roomName = c.req.query("room") ?? "";
  if (!roomName) return c.json({ error: "room required" }, 400);
  const rows = await c.env.DB.prepare(`SELECT type, count FROM reaction_aggregates WHERE room_name = ?`)
    .bind(roomName)
    .all<{ type: string; count: number }>();
  const summary: Record<string, number> = {};
  for (const row of rows.results ?? []) summary[row.type] = row.count;
  return c.json({ summary });
});

reaction.post("/send", requireSession, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json()) as { room?: string; type?: string };
  if (!body.room || !body.type || !ALLOWED.has(body.type)) {
    return c.json({ error: "invalid_params" }, 400);
  }

  const allowed = await checkRateLimit(c.env.KV, `react:${user.userId}:${body.room}`, 30, 60);
  if (!allowed) return c.json({ error: "rate_limited" }, 429);

  const roomRow = await c.env.DB.prepare(`SELECT host_identity FROM rooms WHERE name = ?`)
    .bind(body.room)
    .first<{ host_identity: string | null }>();
  if (roomRow?.host_identity === user.userId) {
    return c.json({ error: "host_cannot_react" }, 403);
  }

  await c.env.DB.prepare(
    `INSERT INTO reaction_aggregates (room_name, type, count) VALUES (?, ?, 1)
     ON CONFLICT(room_name, type) DO UPDATE SET count = count + 1`,
  )
    .bind(body.room, body.type)
    .run();

  const rows = await c.env.DB.prepare(`SELECT type, count FROM reaction_aggregates WHERE room_name = ?`)
    .bind(body.room)
    .all<{ type: string; count: number }>();
  const summary: Record<string, number> = {};
  for (const row of rows.results ?? []) summary[row.type] = row.count;
  return c.json({ ok: true, summary });
});

export { reaction };
