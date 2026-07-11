import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { generateCodeVerifier, generateState, Google, Twitter } from "arctic";
import type { Env } from "../env";
import { SESSION_COOKIE } from "../env";
import { createSession, clearSessionCookie, getSessionUserFromContext } from "../middleware/session";

type AuthEnv = { Bindings: Env };

const auth = new Hono<AuthEnv>();

function appUrl(env: Env): string {
  return env.APP_URL.replace(/\/$/, "");
}

function googleClient(env: Env): Google | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${appUrl(env)}/api/auth/google/callback`);
}

function twitterClient(env: Env): Twitter | null {
  if (!env.TWITTER_CLIENT_ID || !env.TWITTER_CLIENT_SECRET) return null;
  return new Twitter(env.TWITTER_CLIENT_ID, env.TWITTER_CLIENT_SECRET, `${appUrl(env)}/api/auth/twitter/callback`);
}

auth.get("/me", async (c) => {
  const user = await getSessionUserFromContext(c);
  if (!user) return c.json({ authenticated: false });
  return c.json({ authenticated: true, user });
});

auth.post("/logout", async (c) => {
  const secure = c.env.APP_URL.startsWith("https");
  const sessionId = getCookie(c, secure ? SESSION_COOKIE : "fork-session");
  if (sessionId) await c.env.KV.delete(`session:${sessionId}`);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

auth.get("/google", async (c) => {
  const client = googleClient(c.env);
  if (!client) return c.json({ error: "google_not_configured" }, 503);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  await c.env.KV.put(
    `oauth:${state}`,
    JSON.stringify({ codeVerifier, provider: "google" }),
    { expirationTtl: 600 },
  );
  const url = client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);
  return c.redirect(url.toString());
});

auth.get("/google/callback", async (c) => {
  const client = googleClient(c.env);
  if (!client) return c.redirect("/?error=google_not_configured");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.redirect("/?error=oauth_failed");
  const stored = await c.env.KV.get(`oauth:${state}`);
  if (!stored) return c.redirect("/?error=oauth_state_expired");
  await c.env.KV.delete(`oauth:${state}`);
  const { codeVerifier } = JSON.parse(stored) as { codeVerifier: string };
  try {
    const tokens = await client.validateAuthorizationCode(code, codeVerifier);
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    if (!res.ok) return c.redirect("/?error=oauth_profile_failed");
    const profile = (await res.json()) as { sub: string; name?: string; picture?: string };
    await createSession(c, {
      userId: profile.sub,
      name: profile.name ?? "User",
      image: profile.picture,
    });
    return c.redirect("/");
  } catch {
    return c.redirect("/?error=oauth_failed");
  }
});

auth.get("/twitter", async (c) => {
  const client = twitterClient(c.env);
  if (!client) return c.json({ error: "twitter_not_configured" }, 503);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  await c.env.KV.put(
    `oauth:${state}`,
    JSON.stringify({ codeVerifier, provider: "twitter" }),
    { expirationTtl: 600 },
  );
  const url = client.createAuthorizationURL(state, codeVerifier, ["users.read", "tweet.read"]);
  return c.redirect(url.toString());
});

auth.get("/twitter/callback", async (c) => {
  const client = twitterClient(c.env);
  if (!client) return c.redirect("/?error=twitter_not_configured");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.redirect("/?error=oauth_failed");
  const stored = await c.env.KV.get(`oauth:${state}`);
  if (!stored) return c.redirect("/?error=oauth_state_expired");
  await c.env.KV.delete(`oauth:${state}`);
  const { codeVerifier } = JSON.parse(stored) as { codeVerifier: string };
  try {
    const tokens = await client.validateAuthorizationCode(code, codeVerifier);
    const res = await fetch("https://api.twitter.com/2/users/me?user.fields=name,profile_image_url", {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    if (!res.ok) return c.redirect("/?error=oauth_profile_failed");
    const body = (await res.json()) as { data?: { id: string; name?: string; profile_image_url?: string } };
    const profile = body.data;
    if (!profile?.id) return c.redirect("/?error=oauth_profile_failed");
    await createSession(c, {
      userId: `twitter:${profile.id}`,
      name: profile.name ?? "User",
      image: profile.profile_image_url,
    });
    return c.redirect("/");
  } catch {
    return c.redirect("/?error=oauth_failed");
  }
});

/** Local dev only — skip OAuth when providers are not configured */
auth.post("/dev-login", async (c) => {
  if (!c.env.APP_URL.includes("localhost")) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  await createSession(c, {
    userId: `dev:${crypto.randomUUID()}`,
    name: body.name?.slice(0, 32) || "Dev User",
  });
  return c.json({ ok: true });
});

export { auth };
