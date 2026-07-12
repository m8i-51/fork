locals {
  name_prefix = "fork-${var.environment}"
}

# D1 — ルーム / BAN / リアクション集計 / 管理者
resource "cloudflare_d1_database" "fork" {
  account_id            = var.cloudflare_account_id
  name                  = local.name_prefix
  primary_location_hint = var.d1_primary_location_hint
}

# KV — OAuth state / セッション / レートリミット / ルーム一覧キャッシュ
resource "cloudflare_workers_kv_namespace" "fork" {
  account_id = var.cloudflare_account_id
  title      = local.name_prefix
}
