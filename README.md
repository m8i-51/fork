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

### staging / production（IaC 推奨）

D1 / KV は **Terraform**、Worker は **Wrangler** で管理します。詳細は [`infra/README.md`](infra/README.md)。

```bash
cp infra/terraform/staging.tfvars.example infra/terraform/staging.tfvars
# cloudflare_account_id, app_url を編集

export CLOUDFLARE_API_TOKEN="..."
npm run infra:apply -- staging
npm run deploy:staging
```

GitHub Actions では Repository variables に `D1_DATABASE_ID`, `D1_DATABASE_NAME`, `KV_NAMESPACE_ID`, `APP_URL` を設定すると、main への push で overlay 付きデプロイが走ります。

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`（既存どおり）

初回リモート D1（IaC 未使用時）:

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
