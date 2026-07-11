# fork – Live Audio (Cloudflare)

音声ライブ配信アプリ。**Cloudflare 無料枠**（Workers + D1 + DO + KV + Realtime SFU）で運用。

## スタック

| レイヤ | 技術 |
|--------|------|
| フロント | Vite + React SPA（Workers Static Assets） |
| API | Hono on Workers |
| 認証 | Arctic (Google/X) + KV セッション |
| DB | D1 (SQLite) |
| リアルタイム | Durable Objects (WebSocket) + Realtime SFU |

## クイックスタート

```bash
npm install
npx wrangler d1 migrations apply fork --local
npm run dev
```

- http://localhost:8787 — ロビー + API
- ローカルでは **Devログイン** ボタンで OAuth なし試用可

## 環境変数（wrangler secret / vars）

| 名前 | 用途 |
|------|------|
| `APP_URL` | 公開 URL（OAuth callback 用） |
| `REALTIME_APP_ID` / `REALTIME_APP_SECRET` | Cloudflare Realtime SFU |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | X OAuth |

```bash
npx wrangler secret put REALTIME_APP_ID
npx wrangler secret put REALTIME_APP_SECRET
# ...
```

## デプロイ

```bash
npm run deploy
```

GitHub Actions: `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を設定。

初回リモート D1:

```bash
npx wrangler d1 migrations apply fork --remote
```

## 管理者

```bash
npx wrangler d1 execute fork --local --command \
  "INSERT INTO admin_users (identity) VALUES ('<your-oauth-user-id>')"
```

`/admin/monitor` にアクセス。

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | SPA ビルド + wrangler dev |
| `npm run build:app` | フロントビルド |
| `npm run deploy` | Cloudflare へデプロイ |
| `npm run typecheck` | 型チェック |
| `npm run test` | Worker ユニットテスト |

## ディレクトリ

```
app/          Vite React SPA
worker/       Cloudflare Worker (Hono + RoomDO)
packages/shared/  共有バリデーション
packages/db/      D1 マイグレーション
```

## 旧構成について

Next.js + LiveKit + Prisma (`web/`) は削除済み。Cloudflare Realtime SFU に移行。
