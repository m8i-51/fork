#!/usr/bin/env bash
# CI 用 Terraform apply（tfvars ファイル不要）
# Usage: infra/scripts/ci-terraform-apply.sh <staging|production>
set -euo pipefail

ENV="${1:-production}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform"

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
: "${TF_VAR_cloudflare_account_id:?Set TF_VAR_cloudflare_account_id (CLOUDFLARE_ACCOUNT_ID)}"
: "${TF_VAR_app_url:?Set TF_VAR_app_url (APP_URL repository variable)}"

export TF_VAR_environment="$ENV"

cd "$TF_DIR"
terraform init -input=false
terraform apply -auto-approve -input=false

node "$ROOT/infra/scripts/sync-wrangler.mjs" "$ENV"
