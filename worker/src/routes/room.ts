import { Hono } from "hono";
import { isValidDisplayName, normalizeDisplayName } from "@fork/shared";
import type { AppVariables, Env } from "../env";
import { optionalSession, requireSession } from "../middleware/session";
import { clearHost, touchHost } from "../lib/host-lifecycle";
import { genSlug, invalidateRoomListCache, roomStub } from "../lib/room-utils";

type RoomEnv = { Bindings: Env; Variables: AppVariables };

const room = new Hono<RoomEnv>();

room.get("/list", optionalSession, async (c) => {
  const cached = await c.env.KV.get("room:list:public", "json");
  const onlyLive = c.req.query("onlyLive") === "true";
  if (cached && !onlyLive) {
    return c.json({ rooms: cached });
  }

  const rows = await c.env.DB.prepare(`SELECT name, display_name, host_identity, is_public FROM rooms WHERE is_public = 1`).all<{
    name: string;
    display_name: string | null;
    host_identity: string | null;
    is_public: number;
  }>();

  const rooms = await Promise.all(
    (rows.results ?? []).map(async (r) => {
      const stub = roomStub(c.env, r.name);
      const stateRes = await stub.fetch("https://do/internal/state");
      const state = stateRes.ok ? ((await stateRes.json()) as { viewers: number; hostTrackName: string | null }) : { viewers: 0, hostTrackName: null };
      const viewers = state.viewers;
      const hostOnline = Boolean(r.host_identity && state.hostTrackName);
      return {
        name: r.name,
        displayName: r.display_name,
        isPublic: Boolean(r.is_public),
        hostIdentity: r.host_identity,
        viewers,
        hostOnline,
      };
    }),
  );

  const filtered = onlyLive ? rooms.filter((r) => r.viewers > 0 || r.hostOnline) : rooms;
  const payload = filtered.map(({ hostOnline: _h, ...rest }) => rest);

  if (!onlyLive) {
    await c.env.KV.put("room:list:public", JSON.stringify(payload), { expirationTtl: 15 });
  }

  return c.json({ rooms: payload });
});

room.get("/info", optionalSession, async (c) => {
  const roomName = c.req.query("room") ?? "";
  if (!roomName) return c.json({ error: "room is required" }, 400);
  const row = await c.env.DB.prepare(`SELECT * FROM rooms WHERE name = ?`).bind(roomName).first<{
    name: string;
    display_name: string | null;
    host_identity: string | null;
    is_public: number;
  }>();
  const me = c.get("user")?.userId ?? "";
  const hostIdentity = row?.host_identity ?? null;
  return c.json({
    hasHost: Boolean(hostIdentity),
    hostIdentity,
    isHost: hostIdentity ? hostIdentity === me : false,
    isPublic: row ? Boolean(row.is_public) : true,
    displayName: row?.display_name ?? null,
  });
});

room.post("/create", requireSession, async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as { displayName?: string };
  const dn = normalizeDisplayName(body.displayName ?? "");
  if (!isValidDisplayName(dn)) return c.json({ error: "invalid_display_name" }, 400);

  let slug = genSlug();
  for (let i = 0; i < 5; i++) {
    const exists = await c.env.DB.prepare(`SELECT 1 FROM rooms WHERE name = ?`).bind(slug).first();
    if (!exists) break;
    slug = genSlug();
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO rooms (name, display_name, host_identity, is_public, host_last_seen_at, created_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
  )
    .bind(slug, dn, user.userId, now, now)
    .run();

  await invalidateRoomListCache(c.env.KV);
  return c.json({ slug, room: { name: slug, displayName: dn } });
});

room.post("/set-public", requireSession, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const roomName = String(body.room ?? "");
  const isPublic = String(body.isPublic ?? "true") === "true";
  if (!roomName) return c.json({ error: "invalid_params" }, 400);

  const row = await c.env.DB.prepare(`SELECT host_identity FROM rooms WHERE name = ?`).bind(roomName).first<{ host_identity: string | null }>();
  if (!row) return c.json({ error: "room_not_found" }, 404);
  if (row.host_identity && row.host_identity !== user.userId) {
    return c.json({ error: "forbidden" }, 403);
  }

  await c.env.DB.prepare(`UPDATE rooms SET is_public = ? WHERE name = ?`).bind(isPublic ? 1 : 0, roomName).run();
  await invalidateRoomListCache(c.env.KV);
  return c.json({ ok: true, isPublic });
});

room.post("/end", requireSession, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const roomName = String(body.room ?? "");
  if (!roomName) return c.json({ error: "room required" }, 400);

  const cleared = await clearHost(c.env.DB, roomName, user.userId);
  if (!cleared) return c.json({ error: "forbidden" }, 403);

  const stub = roomStub(c.env, roomName);
  await stub.fetch("https://do/internal/stream-ended", { method: "POST" });
  await invalidateRoomListCache(c.env.KV);
  return c.json({ ok: true });
});

room.post("/host-heartbeat", requireSession, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const roomName = String(body.room ?? "");
  if (!roomName) return c.json({ error: "room required" }, 400);
  await touchHost(c.env.DB, roomName, user.userId);
  return c.json({ ok: true });
});

room.get("/:slug/ws", async (c) => {
  const slug = c.req.param("slug");
  if (!slug) return c.json({ error: "room required" }, 400);
  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") return c.json({ error: "expected websocket" }, 426);
  const stub = roomStub(c.env, slug);
  return stub.fetch(c.req.raw);
});

export { room };
