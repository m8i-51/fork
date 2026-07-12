# fork インフラ (IaC)

コンソール操作なしで **D1 / KV** を再現するための Terraform 構成です。  
Worker コードのビルド・デプロイは引き続き **Wrangler** が担当します（Cloudflare 公式の推奨ハイブリッド）。

## 役割分担

| レイヤ | ツール | 管理対象 |
|--------|--------|----------|
| データ基盤 | **Terraform** | D1 データベース、KV 名前空間 |
| アプリ | **Wrangler** | Worker コード、DO マイグレーション、Static Assets、Cron |
| 機密情報 | **wrangler secret** | OAuth / SFU キー（Git に載せない） |

```
Terraform apply
    ↓ outputs (D1 ID, KV ID)
sync-wrangler.mjs → infra/generated/wrangler.<env>.toml
merge-wrangler-config.mjs → wrangler.<env>.ci.toml（リポジトリルート）
    ↓
wrangler deploy -c wrangler.<env>.ci.toml
```

## 初回セットアップ

### 1. 前提

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- Cloudflare API Token（権限: D1 Edit, Workers KV Storage Edit, Account Read）

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."   # CI 用。Terraform 変数にも設定
```

### 2. tfvars を用意

```bash
cp infra/terraform/staging.tfvars.example infra/terraform/staging.tfvars
# cloudflare_account_id, app_url を編集
```

`app_url` はデプロイ後の Workers URL（例: `https://fork-api-staging.<account>.workers.dev`）。  
初回は仮 URL でも可。カスタムドメイン設定後に `terraform apply` で更新。

### 3. Terraform apply

```bash
npm run infra:init
npm run infra:plan -- staging    # 確認
npm run infra:apply -- staging    # D1/KV 作成 + wrangler overlay 生成
```

生成物: `infra/generated/wrangler.staging.toml`

### 4. D1 マイグレーション（リモート）

```bash
npx wrangler d1 migrations apply fork-staging --remote --env staging \
  -c wrangler.toml -c infra/generated/wrangler.staging.toml
```

### 5. Secrets

```bash
cp infra/secrets.example.env infra/secrets.staging.env
# 値を填入

npx wrangler secret bulk infra/secrets.staging.env --env staging \
  -c wrangler.toml -c infra/generated/wrangler.staging.toml
```

### 6. デプロイ

```bash
npm run deploy:staging
```

## 既存リソースの Import

コンソールで作ってしまった D1 / KV がある場合:

```bash
cd infra/terraform
terraform import -var-file=staging.tfvars \
  cloudflare_d1_database.fork '<account_id>/<database_id>'
terraform import -var-file=staging.tfvars \
  cloudflare_workers_kv_namespace.fork '<account_id>/<namespace_id>'
npm run infra:sync -- staging
```

## 環境

| 環境 | D1 名 | Worker 名 |
|------|-------|-----------|
| local | fork (wrangler local) | fork-api |
| staging | fork-staging | fork-api-staging |
| production | fork-production | fork-api-production |

## State 管理

CI では `infra/terraform/terraform.tfstate` を **リポジトリにコミット**して共有します（初回 deploy 後に bot が `[skip ci]` 付きで push）。  
チーム拡大時は Terraform Cloud や R2 backend への移行を検討してください。

## CI（main 自動デプロイ）

`main` への push で `.github/workflows/deploy-cloudflare.yml` が実行されます:

```
1. Terraform apply  → D1 / KV 確保
2. wrangler overlay 生成
3. build + test
4. wrangler secret bulk（GitHub Secrets から）
5. D1 migrations apply
6. wrangler deploy
7. terraform.tfstate を commit [skip ci]
```

手動実行: Actions → Deploy → Run workflow

### GitHub 設定（初回のみ）

**Repository secrets**（Settings → Secrets and variables → Actions）:

| Secret | 必須 | 用途 |
|--------|------|------|
| `CLOUDFLARE_API_TOKEN` | ✅ | Terraform + Wrangler |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | Account ID |
| `REALTIME_APP_ID` | | SFU |
| `REALTIME_APP_SECRET` | | SFU |
| `GOOGLE_CLIENT_ID` | | OAuth |
| `GOOGLE_CLIENT_SECRET` | | OAuth |
| `TWITTER_CLIENT_ID` | | OAuth |
| `TWITTER_CLIENT_SECRET` | | OAuth |

**Repository variables**:

| Variable | 必須 | 例 |
|----------|------|-----|
| `APP_URL` | ✅ | `https://fork-api-production.<subdomain>.workers.dev` |

初回は Workers URL が未確定でも、上記パターンで仮設定 → 初回 deploy 後に実 URL へ更新 → 再 push で反映。

### PR 時

- `infra.yml`: `terraform fmt -check` + `validate` + `plan`（credentials がある場合）
