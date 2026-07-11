import { Hono } from "hono";
import type { AppVariables, Env } from "../env";
import { requireSession } from "../middleware/session";
import { roomStub } from "../lib/room-utils";

type AdminEnv = { Bindings: Env; Variables: AppVariables };

const admin = new Hono<AdminEnv>();

admin.get("/rooms", requireSession, async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare(`SELECT 1 FROM admin_users WHERE identity = ?`).bind(user.userId).first();
  if (!row) return c.json({ error: "forbidden" }, 403);

  const rows = await c.env.DB.prepare(`SELECT name, display_name, host_identity, is_public FROM rooms`).all<{
    name: string;
    display_name: string | null;
    host_identity: string | null;
    is_public: number;
  }>();

  const rooms = await Promise.all(
    (rows.results ?? []).map(async (r) => {
      const stub = roomStub(c.env, r.name);
      const stateRes = await stub.fetch("https://do/internal/state");
      const state = stateRes.ok ? ((await stateRes.json()) as { viewers: number }) : { viewers: 0 };
      return {
        name: r.name,
        displayName: r.display_name,
        hostIdentity: r.host_identity,
        isPublic: Boolean(r.is_public),
        viewers: state.viewers,
      };
    }),
  );

  const total = rooms.reduce((sum, r) => sum + r.viewers, 0);
  return c.json({ rooms, total, count: rooms.length });
});

export { admin };
