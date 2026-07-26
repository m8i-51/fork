# AGENTS.md

## Cursor Cloud specific instructions

`fork` is a live-audio streaming app that runs as a **single Cloudflare Worker** (Hono API +
Durable Objects) which also serves the Vite/React SPA via the `ASSETS` binding. There is only one
service to run locally.

Standard commands live in `README.md` and `package.json` scripts; prefer those. The notes below are
non-obvious caveats discovered during setup (the update script already runs `npm install`).

### Running the app (dev)
- `npm run dev` builds the SPA and starts `wrangler dev` on http://localhost:8787 (API + SPA).
- Before tests or dev work, the local D1 database must be migrated:
  `npx wrangler d1 migrations apply fork --local` (state lives under `.wrangler/`, gitignored).
- Use the **Devログイン** button on the lobby to sign in without OAuth. This only works because
  `APP_URL` contains `localhost` (see `worker/src/routes/auth.ts`); Google/X OAuth need secrets.

### Tests / typecheck
- `npm run typecheck` and `npm run test` (worker vitest via `@cloudflare/vitest-pool-workers`).
- Non-obvious: `npm run test` fails with `assets.directory ... does not exist` unless `app/dist`
  exists, because `wrangler.toml` points `assets.directory` at `./app/dist`. Run `npm run build:app`
  first (CI runs `build:app` before `test` for this reason).

### Known local-only quirks (not environment bugs)
- `GET /api/room/list` **without** `?onlyLive=true` returns 500 locally: the cache path calls
  `KV.put(..., { expirationTtl: 15 })` and local miniflare requires TTL ≥ 60. The SPA only calls
  `/api/room/list?onlyLive=true`, which skips that path, so the lobby is unaffected.
- Entering a room shows `session/new failed: 503` unless `REALTIME_APP_ID` / `REALTIME_APP_SECRET`
  (Cloudflare Realtime SFU) are configured. Room creation, auth, chat UI, and navigation still work;
  only live audio publishing/subscribing needs those secrets.
- Terraform is only used for staging/production infra (`infra/`); it is not needed for local dev.
