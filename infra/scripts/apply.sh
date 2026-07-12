#!/usr/bin/env bash
# Usage: infra/scripts/apply.sh [plan|apply] [staging|production]
set -euo pipefail

ACTION="${1:-plan}"
ENV="${2:-staging}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform"
VAR_FILE="$TF_DIR/${ENV}.tfvars"

if [[ ! -f "$VAR_FILE" ]]; then
  echo "Missing $VAR_FILE — copy from ${ENV}.tfvars.example and fill in values." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Set CLOUDFLARE_API_TOKEN before running Terraform." >&2
  exit 1
fi

cd "$TF_DIR"
terraform init -input=false

case "$ACTION" in
  plan)
    terraform plan -var-file="$VAR_FILE" -out="tfplan-${ENV}"
    echo "Plan saved to infra/terraform/tfplan-${ENV}"
    ;;
  apply)
    terraform apply -var-file="$VAR_FILE" -auto-approve
    node "$ROOT/infra/scripts/sync-wrangler.mjs" "$ENV"
    echo ""
    echo "Next steps:"
    echo "  1. wrangler d1 migrations apply fork-${ENV} --remote --env ${ENV} -c wrangler.${ENV}.ci.toml"
    echo "  2. wrangler secret bulk infra/secrets.${ENV}.env --env ${ENV} -c wrangler.${ENV}.ci.toml"
    echo "  3. npm run deploy:${ENV}"
    ;;
  *)
    echo "Usage: $0 [plan|apply] [staging|production]" >&2
    exit 1
    ;;
esac
