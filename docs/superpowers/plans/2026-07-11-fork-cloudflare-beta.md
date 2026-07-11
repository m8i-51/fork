# fork Cloudflare β版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LiveKit + Vercel 依存を除去し、Cloudflare 無料枠（Pages / Workers / D1 / DO / Realtime SFU）だけで音声ライブ配信 β を運用可能にする。

**Architecture:** Next.js UI を Cloudflare Pages (OpenNext) に載せ、API・認証・SFU セッション発行を Workers + D1 で行う。ルーム単位のリアルタイム状態（視聴者数・チャット）は WebSocket Hibernation 対応の RoomDO が担当。メディアは Cloudflare Realtime SFU（月 1,000 GB 無料）。

**Tech Stack:** Cloudflare Workers, Durable Objects, D1, KV, Pages, OpenNext, Realtime SFU, Hono, Drizzle ORM, Auth.js, Vitest, Playwright

**Design Spec:** `docs/superpowers/specs/2026-07-11-fork-cloudflare-design.md`

---

## File Structure (新規)

```
/
├── wrangler.toml                 # Workers + D1 + DO + KV bindings
├── worker/
│   ├── src/
│   │   ├── index.ts              # Hono app entry
│   │   ├── env.ts                # Env type definitions
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── room.ts
│   │   │   ├── session.ts        # SFU session minting
│   │   │   ├── reaction.ts
│   │   │   └── moderation.ts
│   │   ├── durable-objects/
│   │   │   └── room.ts           # RoomDO
│   │   ├── lib/
│   │   │   ├── sfu.ts            # Realtime SFU HTTPS API client
│   │   │   ├── rate-limit.ts     # KV-based limiter
│   │   │   └── host-lifecycle.ts
│   │   └── cron/
│   │       └── cleanup.ts
│   └── test/
│       ├── room-do.test.ts
│       └── host-lifecycle.test.ts
├── packages/
│   └── db/
│       ├── schema.ts             # Drizzle D1 schema
│       └── migrations/
└── web/                          # 既存 Next.js（段階的に SFU client 差し替え）
    └── src/lib/
        ├── sfu-client.ts         # WebRTC + SFU session helper
        └── room-ws.ts            # RoomDO WebSocket client
```

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

[vars]
# REALTIME_APP_ID set via wrangler secret
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

- [ ] **Step 5: Hono エントリポイント**

`worker/src/index.ts`:
```typescript
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
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

### Task 3: フロントエンド SFU クライアント

**Files:**
- Create: `web/src/lib/sfu-client.ts`
- Modify: `web/src/pages/room/[name].tsx`
- Modify: `web/src/components/InRoomUI.tsx`
- Delete usage: `@livekit/components-react`, `livekit-client`（最終 Step）

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

`LiveKitRoom` / `useRoomContext` を除去。マイク toggle は `MediaStreamTrack.enabled` で制御。

- [ ] **Step 3: DataChannel でリアクション broadcast**

SFU DataChannels API を使用（`topic: "reaction"` 相当）。既存 UI の 👍/🎁 ボタンは維持。

- [ ] **Step 4: package.json から livekit 依存削除**

```bash
cd web && npm uninstall @livekit/components-react livekit-client
```

- [ ] **Step 5: E2E 更新**

`web/tests/room.page.spec.ts` — LiveKit セレクタを SFU 接続状態バッジに変更。

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: replace LiveKit with Cloudflare Realtime SFU client"
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
- Create: `web/src/lib/room-ws.ts`
- Modify: `web/src/components/InRoomUI.tsx`
- Remove: `web/src/pages/api/room/viewers/stream.ts`（Workers 移行後）

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
- Modify: `web/src/pages/admin/monitor.tsx`

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
- Modify: `web/src/components/InRoomUI.tsx`

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

### Task 8: Pages デプロイ + CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-cloudflare.yml`

- [ ] **Step 1: OpenNext Cloudflare 設定**

```bash
cd web && npx @opennextjs/cloudflare init
```

- [ ] **Step 2: GitHub Actions — PR で vitest + playwright、main で wrangler deploy**

- [ ] **Step 3: 環境変数を Cloudflare Dashboard / wrangler secret に設定**

- [ ] **Step 4: Commit**

```bash
git commit -m "ci: add Cloudflare Pages and Workers deploy pipeline"
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
| RBAC | Task 6 |
| レートリミット | Task 7 |
| KV キャッシュ | Task 0 (KV binding), Task 7 拡張で room list |
| Cron cleanup | Task 4 |
| OpenNext Pages | Task 8 |
