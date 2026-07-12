import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppVariables, Env, SessionUser } from "../env";
import { SESSION_COOKIE, SESSION_TTL } from "../env";

function sessionCookieName(env: Env): string {
  return env.APP_URL.startsWith("https") ? SESSION_COOKIE : "fork-session";
}

export async function getSessionUser(env: Env, cookieHeader: string | undefined): Promise<SessionUser | null> {
  const name = sessionCookieName(env);
  const match = (cookieHeader ?? "").match(new RegExp(`${name}=([^;]+)`));
  const sessionId = match?.[1];
  if (!sessionId) return null;
  const raw = await env.KV.get(`session:${sessionId}`, "json");
  if (!raw || typeof raw !== "object") return null;
  const user = raw as SessionUser;
  if (!user.userId) return null;
  return user;
}

export async function createSession(c: Context<{ Bindings: Env }>, user: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  await c.env.KV.put(`session:${sessionId}`, JSON.stringify(user), { expirationTtl: SESSION_TTL });
  const secure = c.env.APP_URL.startsWith("https");
  setCookie(c, sessionCookieName(c.env), sessionId, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return sessionId;
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): void {
  deleteCookie(c, sessionCookieName(c.env), { path: "/" });
}

export const requireSession = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const user = await getSessionUser(c.env, c.req.header("Cookie"));
  if (!user) return c.json({ error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
});

export const optionalSession = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const user = await getSessionUser(c.env, c.req.header("Cookie"));
  if (user) c.set("user", user);
  await next();
});

export async function getSessionUserFromContext(c: Context<{ Bindings: Env }>): Promise<SessionUser | null> {
  return getSessionUser(c.env, c.req.header("Cookie"));
}
