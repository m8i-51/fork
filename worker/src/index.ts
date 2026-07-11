import { Hono } from "hono";
import { auth } from "./routes/auth";
import { room } from "./routes/room";
import { sessionRoutes } from "./routes/session";
import { reaction } from "./routes/reaction";
import { moderation } from "./routes/moderation";
import { admin } from "./routes/admin";
import type { AppVariables, Env } from "./env";
import { releaseStaleHosts } from "./lib/host-lifecycle";
import { invalidateRoomListCache } from "./lib/room-utils";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.get("/api/health", (c) => c.json({ ok: true, service: "fork-api" }));

app.route("/api/auth", auth);
app.route("/api/room", room);
app.route("/api/session", sessionRoutes);
app.route("/api/reaction", reaction);
app.route("/api/moderation", moderation);
app.route("/api/admin", admin);

async function runCleanup(env: Env): Promise<void> {
  await releaseStaleHosts(env.DB);
  await invalidateRoomListCache(env.KV);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const res = await app.fetch(request, env, ctx);
    if (res.status !== 404) return res;
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCleanup(env));
  },
};

export { RoomDO } from "./durable-objects/room";
