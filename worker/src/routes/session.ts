import { Hono } from "hono";
import type { AppVariables, Env } from "../env";
import { requireSession } from "../middleware/session";
import { touchHost } from "../lib/host-lifecycle";
import {
  addLocalAudioTrack,
  closeTracks,
  createSfuSession,
  pullRemoteTrack,
  renegotiate,
  sfuConfigured,
} from "../lib/sfu";
import { roomStub } from "../lib/room-utils";

type SessionEnv = { Bindings: Env; Variables: AppVariables };

const sessionRoutes = new Hono<SessionEnv>();

sessionRoutes.post("/new", requireSession, async (c) => {
  if (!sfuConfigured(c.env)) return c.json({ error: "sfu_not_configured" }, 503);
  const user = c.get("user");
  const body = (await c.req.json()) as { room?: string; publish?: boolean };
  const roomName = body.room ?? "";
  const wantPublish = body.publish !== false;
  if (!roomName) return c.json({ error: "room required" }, 400);

  const banned = await c.env.DB.prepare(`SELECT 1 FROM bans WHERE room_name = ? AND identity = ?`)
    .bind(roomName, user.userId)
    .first();
  if (banned) return c.json({ error: "banned" }, 403);

  const row = await c.env.DB.prepare(`SELECT host_identity FROM rooms WHERE name = ?`).bind(roomName).first<{ host_identity: string | null }>();
  let canPublish = wantPublish;
  if (canPublish && row?.host_identity && row.host_identity !== user.userId) {
    canPublish = false;
  }

  if (canPublish) {
    const now = new Date().toISOString();
    if (!row) {
      await c.env.DB.prepare(
        `INSERT INTO rooms (name, host_identity, is_public, host_last_seen_at, created_at) VALUES (?, ?, 1, ?, ?)`,
      )
        .bind(roomName, user.userId, now, now)
        .run();
    } else if (!row.host_identity) {
      await c.env.DB.prepare(`UPDATE rooms SET host_identity = ?, host_last_seen_at = ? WHERE name = ?`)
        .bind(user.userId, now, roomName)
        .run();
    } else {
      await touchHost(c.env.DB, roomName, user.userId);
    }

    await c.env.DB.prepare(`DELETE FROM reaction_aggregates WHERE room_name = ?`).bind(roomName).run();
  }

  const sessionId = await createSfuSession(c.env);
  const stub = roomStub(c.env, roomName);
  const stateRes = await stub.fetch("https://do/internal/state");
  const state = stateRes.ok
    ? ((await stateRes.json()) as { hostTrackName: string | null })
    : { hostTrackName: null };

  return c.json({
    sessionId,
    role: canPublish ? "host" : "viewer",
    canPublish,
    hostTrackName: canPublish ? null : state.hostTrackName,
  });
});

sessionRoutes.post("/publish", requireSession, async (c) => {
  if (!sfuConfigured(c.env)) return c.json({ error: "sfu_not_configured" }, 503);
  const body = (await c.req.json()) as { sessionId?: string; room?: string; sdpOffer?: string };
  if (!body.sessionId || !body.room || !body.sdpOffer) return c.json({ error: "invalid_params" }, 400);

  const result = await addLocalAudioTrack(c.env, body.sessionId, body.sdpOffer);
  const stub = roomStub(c.env, body.room);
  await stub.fetch("https://do/internal/host-track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackName: result.trackName }),
  });

  return c.json({
    trackName: result.trackName,
    sessionDescription: result.sessionDescription,
  });
});

sessionRoutes.post("/subscribe", requireSession, async (c) => {
  if (!sfuConfigured(c.env)) return c.json({ error: "sfu_not_configured" }, 503);
  const body = (await c.req.json()) as {
    sessionId?: string;
    trackName?: string;
    sdpOffer?: string;
  };
  if (!body.sessionId || !body.trackName || !body.sdpOffer) {
    return c.json({ error: "invalid_params" }, 400);
  }

  const result = await pullRemoteTrack(c.env, body.sessionId, body.trackName, body.sdpOffer);
  return c.json(result);
});

sessionRoutes.post("/renegotiate", requireSession, async (c) => {
  if (!sfuConfigured(c.env)) return c.json({ error: "sfu_not_configured" }, 503);
  const body = (await c.req.json()) as { sessionId?: string; sdpAnswer?: string };
  if (!body.sessionId || !body.sdpAnswer) return c.json({ error: "invalid_params" }, 400);
  await renegotiate(c.env, body.sessionId, body.sdpAnswer);
  return c.json({ ok: true });
});

sessionRoutes.post("/close", requireSession, async (c) => {
  if (!sfuConfigured(c.env)) return c.json({ error: "sfu_not_configured" }, 503);
  const body = (await c.req.json()) as { sessionId?: string; trackNames?: string[]; room?: string };
  if (!body.sessionId) return c.json({ error: "invalid_params" }, 400);
  await closeTracks(c.env, body.sessionId, body.trackNames ?? []);
  if (body.room) {
    const stub = roomStub(c.env, body.room);
    await stub.fetch("https://do/internal/host-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackName: null }),
    });
  }
  return c.json({ ok: true });
});

export { sessionRoutes };
