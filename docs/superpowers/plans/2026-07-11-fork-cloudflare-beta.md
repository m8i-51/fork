# fork Cloudflare β版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LiveKit + Next.js + Vercel 依存を全廃し、Cloudflare 無料枠（Workers + Static Assets / D1 / DO / KV / Realtime SFU）だけで音声ライブ配信 β を運用可能にする。

**Architecture:** Vite + React SPA を Workers Static Assets で配信し、同一 Worker 上の Hono が API・OAuth・SFU セッションを担当。ルーム単位のリアルタイム状態は RoomDO（WebSocket Hibernation）。認証は Arctic + KV セッション。

**Tech Stack:** Cloudflare Workers, Static Assets, Durable Objects, D1, KV, Realtime SFU, Vite, React, TanStack Router, Hono, Arctic, Drizzle ORM, Vitest, Playwright

**Design Spec:** `docs/superpowers/specs/2026-07-11-fork-cloudflare-design.md`

---

## File Structure（確定）

```
/
├── package.json                  # npm workspaces root
├── wrangler.toml                 # Worker + D1 + DO + KV + Static Assets
├── worker/
│   ├── src/
│   │   ├── index.ts              # Hono app + ASSETS fallback
│   │   ├── env.ts
│   │   ├── middleware/
│   │   │   └── session.ts        # KV session from cookie
│   │   ├── routes/
│   │   │   ├── auth.ts           # Arctic OAuth (Google/X)
│   │   │   ├── room.ts
│   │   │   ├── session.ts
│   │   │   ├── reaction.ts
│   │   │   └── moderation.ts
│   │   ├── durable-objects/
│   │   │   └── room.ts
│   │   ├── lib/
│   │   │   ├── sfu.ts
│   │   │   ├── rate-limit.ts
│   │   │   └── host-lifecycle.ts
│   │   └── cron/
│   │       └── cleanup.ts
│   └── test/
├── app/                          # Vite + React SPA（web/ を置換）
│   ├── index.html
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── routes/
│   │   │   ├── index.tsx         # ロビー
│   │   │   ├── room.$slug.tsx    # 配信/視聴
│   │   │   └── admin.monitor.tsx
│   │   ├── components/
│   │   │   ├── Chat.tsx
│   │   │   ├── InRoomUI.tsx
│   │   │   └── Participants.tsx
│   │   └── lib/
│   │       ├── api.ts            # fetch wrapper (credentials: include)
│   │       ├── sfu-client.ts
│   │       └── room-ws.ts
│   └── e2e/                      # Playwright（新設）
└── packages/
    └── db/
        ├── schema.ts
        └── migrations/
```

**廃止:** `web/` ディレクトリ全体（Next.js, NextAuth, Prisma, LiveKit, 旧 Playwright）

---

## Phase 0: Cloudflare 基盤セットアップ

### Task 0: Wrangler プロジェクト初期化

**Files:**
- Create: `wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/src/env.ts`
- Create: `packages/db/schema.ts`

- [ ] **Step 1: wrangler.toml を作成**

```toml
name = "fork-api"
main = "worker/src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "fork"
database_id = "<CREATE_VIA_CLI>"

[[kv_namespaces]]
binding = "KV"
id = "<CREATE_VIA_CLI>"

[durable_objects]
bindings = [{ name = "ROOM", class_name = "RoomDO" }]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RoomDO"]

[triggers]
crons = ["*/5 * * * *"]

[assets]
directory = "./app/dist"
not_found_handling = "single-page-application"
binding = "ASSETS"

[vars]
# REALTIME_APP_ID set via wrangler secret
# OAUTH redirect base = https://fork-api.<account>.workers.dev
```

- [ ] **Step 2: D1 データベース作成**

Run:
```bash
npx wrangler d1 create fork
npx wrangler kv namespace create FORK_KV
```
Expected: database_id / kv id が出力される → wrangler.toml に反映

- [ ] **Step 3: Drizzle スキーマ定義**

`packages/db/schema.ts`:
```typescript
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  name: text("name").primaryKey(),
  displayName: text("display_name"),
  hostIdentity: text("host_identity"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  hostLastSeenAt: text("host_last_seen_at"),
  createdAt: text("created_at").notNull(),
});

export const bans = sqliteTable("bans", {
  roomName: text("room_name").notNull(),
  identity: text("identity").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.roomName, t.identity] })]);

export const reactionAggregates = sqliteTable("reaction_aggregates", {
  roomName: text("room_name").notNull(),
  type: text("type").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.roomName, t.type] })]);

export const adminUsers = sqliteTable("admin_users", {
  identity: text("identity").primaryKey(),
});
```

- [ ] **Step 4: マイグレーション SQL 適用**

Create `packages/db/migrations/0001_init.sql`（設計書 §6 の DDL）を作成し:
```bash
npx wrangler d1 execute fork --remote --file=packages/db/migrations/0001_init.sql
npx wrangler d1 execute fork --local --file=packages/db/migrations/0001_init.sql
```

- [ ] **Step 5: Hono エントリポイント（API + SPA fallback）**

`worker/src/index.ts`:
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

// Phase 1+ で auth/room ルートを追加

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx).then((res) => {
      if (res.status !== 404) return res;
      return env.ASSETS.fetch(request);
    });
  },
  scheduled: (event, env, ctx) => { /* cron */ },
};
export { RoomDO } from "./durable-objects/room";
```

- [ ] **Step 6: ローカル起動確認**

Run: `npx wrangler dev`
Expected: `GET http://localhost:8787/api/health` → `{"ok":true}`

- [ ] **Step 7: Commit**

```bash
git add wrangler.toml worker/ packages/db/
git commit -m "feat: add Cloudflare Workers foundation with D1 schema"
```

---

### Task 1: RoomDO スケルトン（WebSocket Hibernation）

**Files:**
- Create: `worker/src/durable-objects/room.ts`
- Create: `worker/test/room-do.test.ts`

- [ ] **Step 1: 失敗テストを書く**

`worker/test/room-do.test.ts`:
```typescript
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("RoomDO", () => {
  it("returns viewer count on connect", async () => {
    const id = env.ROOM.idFromName("test-room");
    const stub = env.ROOM.get(id);
    const res = await stub.fetch("https://do/viewer-count");
    expect(res.status).toBe(200);
    const body = await res.json<{ viewers: number }>();
    expect(body.viewers).toBe(0);
  });
});
```

- [ ] **Step 2: テスト実行（FAIL 確認）**

Run: `npx vitest run worker/test/room-do.test.ts`
Expected: FAIL — RoomDO not implemented

- [ ] **Step 3: RoomDO 実装**

`worker/src/durable-objects/room.ts`:
```typescript
import { DurableObject } from "cloudflare:workers";

export class RoomDO extends DurableObject {
  private viewers = new Set<string>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/viewer-count") {
      return Response.json({ viewers: this.viewers.size });
    }
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = typeof message === "string" ? JSON.parse(message) : null;
    if (data?.type === "join" && typeof data.identity === "string") {
      this.viewers.add(data.identity);
      ws.send(JSON.stringify({ type: "viewers", count: this.viewers.size }));
      this.broadcast(JSON.stringify({ type: "viewers", count: this.viewers.size }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    // identity は join 時に ws.serializeAttachment で保存する（Task 2 で拡張）
  }

  private broadcast(payload: string) {
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(payload);
    }
  }
}
```

- [ ] **Step 4: テスト PASS 確認**

Run: `npx vitest run worker/test/room-do.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add worker/src/durable-objects/room.ts worker/test/room-do.test.ts
git commit -m "feat: add RoomDO with WebSocket hibernation skeleton"
```

---

### Task 1B: Vite + React SPA スキャフォールド

**Files:**
- Create: `app/package.json`, `app/vite.config.ts`, `app/index.html`
- Create: `app/src/main.tsx`, `app/src/routes/__root.tsx`
- Create: `package.json` (workspace root)
- Remove: `web/`（Task 3 完了後に削除）

- [ ] **Step 1: npm workspaces ルート**

`/package.json`:
```json
{
  "name": "fork",
  "private": true,
  "workspaces": ["app", "worker", "packages/db"],
  "scripts": {
    "dev": "npm run build:app && wrangler dev",
    "build:app": "npm run build -w app",
    "deploy": "npm run build:app && wrangler deploy",
    "test": "vitest run",
    "e2e": "playwright test -c app/playwright.config.ts"
  }
}
```

- [ ] **Step 2: Vite プロジェクト作成**

```bash
cd app && npm create vite@latest . -- --template react-ts
npm install @tanstack/react-router @tanstack/router-plugin
```

`app/vite.config.ts` — dev proxy to wrangler:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  build: { outDir: "dist" },
});
```

- [ ] **Step 3: 既存 UI を移植**

`web/src/components/{Chat,InRoomUI,Participants}.tsx` → `app/src/components/`  
`web/src/pages/globals.css` → `app/src/styles/globals.css`  
LiveKit 依存コードは Stub に置換（Task 3 で SFU 接続に差し替え）

- [ ] **Step 4: TanStack Router ルート**

- `/` — ロビー（旧 `index.tsx` のロビー部分）
- `/room/$slug` — 配信/視聴（`?publish=true|false` を search param で受ける）
- `/admin/monitor` — 監視

- [ ] **Step 5: api.ts ラッパー**

```typescript
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 6: ビルド + wrangler dev で SPA 配信確認**

Run:
```bash
npm run build:app && npx wrangler dev
```
Expected: `http://localhost:8787/` → Vite SPA、`/api/health` → JSON

- [ ] **Step 7: Commit**

```bash
git add app/ package.json
git commit -m "feat: add Vite React SPA with TanStack Router"
```

---

### Task 1C: Arctic OAuth + KV セッション

**Files:**
- Create: `worker/src/routes/auth.ts`
- Create: `worker/src/middleware/session.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Arctic インストール**

```bash
cd worker && npm install arctic hono
```

- [ ] **Step 2: session middleware**

`worker/src/middleware/session.ts`:
```typescript
import type { Context, Next } from "hono";
import type { Env } from "../env";

const COOKIE = "__Host-fork-session";

export async function requireSession(c: Context<{ Bindings: Env }>, next: Next) {
  const sessionId = getCookie(c, COOKIE);
  if (!sessionId) return c.json({ error: "unauthorized" }, 401);
  const raw = await c.env.KV.get(`session:${sessionId}`, "json");
  if (!raw) return c.json({ error: "unauthorized" }, 401);
  c.set("user", raw as { userId: string; name: string });
  return next();
}

export function getCookie(c: Context, name: string): string | undefined {
  const header = c.req.header("Cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}
```

- [ ] **Step 3: auth routes (Google + X)**

`worker/src/routes/auth.ts` — Arctic `Google`, `Twitter` クライアント。callback で:
1. `crypto.randomUUID()` → sessionId
2. `KV.put(`session:${id}`, { userId, name }, { expirationTtl: 604800 })`
3. `Set-Cookie: __Host-fork-session=...`

Secrets:
```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put TWITTER_CLIENT_ID
npx wrangler secret put TWITTER_CLIENT_SECRET
```

- [ ] **Step 4: SPA ログインボタン**

`app/src/routes/index.tsx` — `<a href="/api/auth/google">Googleでサインイン</a>`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add Arctic OAuth with KV session cookies"
```

---

## Phase 1: Realtime SFU 音声配信

### Task 2: SFU セッション発行 API

**Files:**
- Create: `worker/src/lib/sfu.ts`
- Create: `worker/src/routes/session.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: SFU API クライアント**

`worker/src/lib/sfu.ts` — Cloudflare Realtime SFU HTTPS API ラッパー:
```typescript
const SFU_BASE = "https://rtc.live.cloudflare.com/v1";

export async function createSession(appId: string, appSecret: string): Promise<string> {
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/new`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`SFU session create failed: ${res.status}`);
  const json = await res.json<{ sessionId: string }>();
  return json.sessionId;
}

export async function createPublishTrack(
  appId: string,
  appSecret: string,
  sessionId: string,
): Promise<{ trackName: string; sdpOffer: string }> {
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/${sessionId}/tracks/new`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tracks: [{ location: "local", kind: "audio", mimeType: "audio/opus" }],
    }),
  });
  if (!res.ok) throw new Error(`SFU track create failed: ${res.status}`);
  const json = await res.json<{ tracks: Array<{ trackName: string; sdpOffer: string }> }>();
  return json.tracks[0];
}
```

- [ ] **Step 2: `/api/session` ルート**

`worker/src/routes/session.ts` — 認証済みユーザーに SFU sessionId + role(host/viewer) を返す。host の場合は `rooms.host_identity` をセット、viewer は subscribe track を返す。

- [ ] **Step 3: Secrets 設定**

```bash
npx wrangler secret put REALTIME_APP_ID
npx wrangler secret put REALTIME_APP_SECRET
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add Realtime SFU session API"
```

---

### Task 3: フロントエンド SFU クライアント + web/ 削除

**Files:**
- Create: `app/src/lib/sfu-client.ts`
- Create: `app/src/lib/room-ws.ts`
- Modify: `app/src/components/InRoomUI.tsx`
- Modify: `app/src/routes/room.$slug.tsx`
- Delete: `web/` ディレクトリ全体
- Delete: `livekit/` ディレクトリ（docker-compose）
- Delete: `Makefile` の livekit ターゲット

- [ ] **Step 1: sfu-client.ts — RTCPeerConnection ラッパー**

```typescript
export class SfuAudioClient {
  private pc: RTCPeerConnection;

  constructor(private sessionId: string) {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });
  }

  async publishMic(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getAudioTracks()) {
      this.pc.addTrack(track, stream);
    }
    // SDP offer/answer exchange via /api/session/* endpoints
  }

  async subscribeRemoteAudio(onTrack: (track: MediaStreamTrack) => void): Promise<void> {
    this.pc.ontrack = (ev) => {
      if (ev.track.kind === "audio") onTrack(ev.track);
    };
  }

  disconnect(): void {
    this.pc.close();
  }
}
```

- [ ] **Step 2: InRoomUI を SfuAudioClient に差し替え**

LiveKit 参照をすべて除去。マイク toggle は `MediaStreamTrack.enabled` で制御。

- [ ] **Step 3: DataChannel でリアクション broadcast**

SFU DataChannels API を使用。既存 UI の 👍/🎁 ボタンは維持。

- [ ] **Step 4: web/ と livekit/ を削除**

```bash
git rm -r web/ livekit/
# Makefile から livekit-up/down を削除
```

- [ ] **Step 5: E2E 新設**

`app/e2e/room.spec.ts` — 接続状態バッジ・配信開始フローを Playwright で検証。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: replace LiveKit/Next.js with SFU client on Vite SPA"
```

---

## Phase 2: 状態管理・host ライフサイクル

### Task 4: hostIdentity 解放

**Files:**
- Create: `worker/src/lib/host-lifecycle.ts`
- Create: `worker/src/cron/cleanup.ts`
- Modify: `worker/src/routes/session.ts`

- [ ] **Step 1: 失敗テスト**

`worker/test/host-lifecycle.test.ts`:
```typescript
it("clears host_identity when host inactive for 60s", async () => {
  // seed room with host + old host_last_seen_at
  // run cleanup
  // expect host_identity IS NULL
});
```

- [ ] **Step 2: host-lifecycle.ts 実装**

```typescript
export async function releaseStaleHosts(db: D1Database, thresholdSec = 60): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdSec * 1000).toISOString();
  const result = await db
    .prepare(
      `UPDATE rooms SET host_identity = NULL, host_last_seen_at = NULL
       WHERE host_identity IS NOT NULL AND host_last_seen_at < ?`,
    )
    .bind(cutoff)
    .run();
  return result.meta.changes ?? 0;
}
```

- [ ] **Step 3: 配信終了 API**

`POST /api/room/end` — host のみ。`host_identity = NULL`、RoomDO に `{ type: "stream_ended" }` broadcast。

- [ ] **Step 4: Cron 5 分ごとに cleanup 実行**

- [ ] **Step 5: フロント — 退出時 `/api/room/end` 呼び出し**

`InRoomUI` の「配信終了」ボタンから呼ぶ。

- [ ] **Step 6: Commit**

```bash
git commit -m "fix: release host_identity on stream end and stale timeout"
```

---

### Task 5: 視聴者数 WebSocket 移行

**Files:**
- Create: `app/src/lib/room-ws.ts`（Task 3 で作成済みなら拡張）
- Modify: `app/src/components/InRoomUI.tsx`

- [ ] **Step 1: room-ws.ts クライアント**

```typescript
export function connectRoomWs(slug: string, identity: string, onViewers: (n: number) => void): WebSocket {
  const ws = new WebSocket(`${location.origin.replace("http", "ws")}/api/room/${slug}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ type: "join", identity }));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "viewers") onViewers(msg.count);
  };
  return ws;
}
```

- [ ] **Step 2: InRoomUI — SSE / presence heartbeat 削除、WS に置換**

- [ ] **Step 3: RoomDO — disconnect 時 viewers Set から除去**

`webSocketClose` で `serializeAttachment` から identity 取得 → delete → broadcast。

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: replace SSE viewer count with RoomDO WebSocket"
```

---

## Phase 3: β 運用品質

### Task 6: 管理者 RBAC

**Files:**
- Modify: `worker/src/routes/room.ts`
- Modify: `app/src/routes/admin.monitor.tsx`

- [ ] **Step 1: admin_users シード**

```bash
npx wrangler d1 execute fork --command "INSERT INTO admin_users (identity) VALUES ('<your-oauth-sub>')"
```

- [ ] **Step 2: `/api/admin/*` ミドルウェア**

```typescript
async function requireAdmin(c: Context, next: Next) {
  const identity = c.get("identity");
  const row = await c.env.DB.prepare("SELECT 1 FROM admin_users WHERE identity = ?").bind(identity).first();
  if (!row) return c.json({ error: "forbidden" }, 403);
  return next();
}
```

- [ ] **Step 3: monitor ページ — 403 時は「権限がありません」表示**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add admin RBAC for monitor page"
```

---

### Task 7: レートリミット + 共有リンク

**Files:**
- Create: `worker/src/lib/rate-limit.ts`
- Modify: `worker/src/routes/reaction.ts`
- Modify: `app/src/components/InRoomUI.tsx`

- [ ] **Step 1: KV レートリミット（10 req/min/user/endpoint）**

- [ ] **Step 2: reaction/send に適用 — 429 返却**

- [ ] **Step 3: 共有リンク UI 追加**

InRoomUI トップバーに「リンクをコピー」ボタン:
```typescript
await navigator.clipboard.writeText(`${location.origin}/room/${roomName}?publish=false`);
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add rate limiting and share link"
```

---

### Task 8: Worker デプロイ + CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-cloudflare.yml`
- Modify: `README.md`

- [ ] **Step 1: GitHub Actions デプロイ**

`.github/workflows/deploy-cloudflare.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - run: npm run build:app
      - run: npm test
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Secrets を Cloudflare Dashboard + GitHub に設定**

Worker secrets: `REALTIME_APP_ID`, `REALTIME_APP_SECRET`, `GOOGLE_*`, `TWITTER_*`  
OAuth callback: `https://fork-api.<account>.workers.dev/api/auth/google/callback`

- [ ] **Step 3: README を Cloudflare 構成に書き換え**

- LiveKit Docker 手順を削除
- `npm run dev` / `npm run deploy` に統一

- [ ] **Step 4: Commit**

```bash
git commit -m "ci: deploy single Worker with Static Assets via wrangler"
```

---

## Phase 4: 将来（別 plan）

- 映像 track 追加（帯域監視必須）
- R2 録画（無料 10 GB 枠）
- チャット D1 永続化（モデレーション）
- カテゴリ・検索（KV + D1 index）

---

## 検証チェックリスト（β リリース前）

- [ ] 配信者: 作成 → 配信 → 終了 → 同一 slug で再配信
- [ ] 視聴者: 30 人同時接続で WS viewer count が一致
- [ ] BAN されたユーザーは `/api/session` が 403
- [ ] 非 admin が `/admin/monitor` で 403
- [ ] LiveKit Docker なしでローカル dev 可能（wrangler dev + SFU credentials）
- [ ] Cloudflare dashboard で SFU egress が想定内

---

## Self-Review（spec coverage）

| Spec 要件 | Plan Task |
|-----------|-----------|
| SFU 無料枠 | Task 2, 3 |
| host 解放 | Task 4 |
| RoomDO WS | Task 1, 5 |
| D1 スキーマ | Task 0 |
| Vite SPA（Next.js 全廃） | Task 1B, 3 |
| Arctic + KV 認証 | Task 1C |
| RBAC | Task 6 |
| レートリミット | Task 7 |
| KV キャッシュ | Task 0, Task 7 |
| Cron cleanup | Task 4 |
| Workers Static Assets デプロイ | Task 8 |
| workers.dev（カスタムドメイン任意） | Task 8 |
