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

### ローカル（開発用 ID）

```bash
npm run deploy
```

### production（CI 自動）

`main` へ merge すると GitHub Actions が **Terraform → マイグレーション → デプロイ** まで実行します。

**初回セットアップ** — GitHub Repository に以下を設定:

| 種別 | 名前 | 必須 |
|------|------|------|
| Secret | `CLOUDFLARE_API_TOKEN` | ✅ |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | ✅ |
| Variable | `APP_URL` | ✅ |
| Secret | `REALTIME_APP_*`, `GOOGLE_*`, `TWITTER_*` | OAuth/SFU 利用時 |

詳細: [`infra/README.md`](infra/README.md)

### 手動デプロイ（staging 等）

```bash
cp infra/terraform/staging.tfvars.example infra/terraform/staging.tfvars
export CLOUDFLARE_API_TOKEN="..."
npm run infra:apply -- staging
npm run deploy:staging
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
| `npm run deploy` | Cloudflare へデプロイ（ローカル dev ID） |
| `npm run deploy:staging` | staging へデプロイ（Terraform overlay 必須） |
| `npm run deploy:production` | production へデプロイ |
| `npm run infra:init` | Terraform 初期化 |
| `npm run infra:plan -- staging` | D1/KV の plan |
| `npm run infra:apply -- staging` | D1/KV 作成 + wrangler overlay 生成 |
| `npm run typecheck` | 型チェック |
| `npm run test` | Worker ユニットテスト |

## ディレクトリ

```
app/          Vite React SPA
worker/       Cloudflare Worker (Hono + RoomDO)
packages/shared/  共有バリデーション
packages/db/      D1 マイグレーション
infra/        Terraform (D1/KV) + wrangler overlay 生成
```

## 旧構成について

Next.js + LiveKit + Prisma (`web/`) は削除済み。Cloudflare Realtime SFU に移行。
