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
    ↓
wrangler deploy -c wrangler.toml -c infra/generated/wrangler.<env>.toml
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

デフォルトは `infra/terraform/terraform.tfstate`（ローカル）。  
チーム運用では **Terraform Cloud** や **S3/R2 backend** を `versions.tf` に追加してください。

## CI

- PR / push: `terraform fmt -check` + `validate` + `plan`（Secrets がある場合）
- main デプロイ: Repository **variables** で overlay を生成 → wrangler deploy

### GitHub Repository variables（production デプロイ用）

| Variable | 例 |
|----------|-----|
| `APP_URL` | `https://fork-api-production.xxxx.workers.dev` |
| `D1_DATABASE_ID` | Terraform output `d1_database_id` |
| `D1_DATABASE_NAME` | `fork-production` |
| `KV_NAMESPACE_ID` | Terraform output `kv_namespace_id` |
| `WORKER_NAME` | （任意）`fork-api-production` |

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`、OAuth/SFU は `wrangler secret bulk` で別途。
