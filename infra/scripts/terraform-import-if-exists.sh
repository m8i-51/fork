#!/usr/bin/env bash
# 既存の D1 / KV を Terraform state に import（初回 CI 失敗後の復旧用）
set -euo pipefail

ENV="${1:-production}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform"

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN}"
: "${TF_VAR_cloudflare_account_id:?Set TF_VAR_cloudflare_account_id}"
export TF_VAR_environment="$ENV"

NAME_PREFIX="fork-${ENV}"
ACCOUNT_ID="$TF_VAR_cloudflare_account_id"

cd "$TF_DIR"
terraform init -input=false

import_if_missing() {
  local resource="$1"
  local id="$2"
  if terraform state show "$resource" >/dev/null 2>&1; then
    echo "State already has $resource"
    return 0
  fi
  if [[ -z "$id" ]]; then
    return 0
  fi
  echo "Importing $resource ($id)"
  terraform import -input=false "$resource" "$id"
}

# D1
D1_JSON="$(npx wrangler d1 list --json 2>/dev/null || echo '[]')"
D1_ID="$(node -e "
  const rows = JSON.parse(process.argv[1]);
  const row = rows.find((r) => r.name === process.argv[2]);
  process.stdout.write(row?.uuid ?? '');
" "$D1_JSON" "$NAME_PREFIX")"

if [[ -n "$D1_ID" ]]; then
  import_if_missing "cloudflare_d1_database.fork" "${ACCOUNT_ID}/${D1_ID}"
fi

# KV — wrangler に --json がないので API を直接叩く
KV_JSON="$(curl -fsS \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces")"
KV_ID="$(node -e "
  const body = JSON.parse(process.argv[1]);
  const row = (body.result ?? []).find((r) => r.title === process.argv[2]);
  process.stdout.write(row?.id ?? '');
" "$KV_JSON" "$NAME_PREFIX")"

if [[ -n "$KV_ID" ]]; then
  import_if_missing "cloudflare_workers_kv_namespace.fork" "${ACCOUNT_ID}/${KV_ID}"
fi
