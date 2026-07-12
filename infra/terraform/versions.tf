terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # 本番では remote backend（Terraform Cloud / S3+R2 等）を推奨。
  # backend "cloudflare" { ... }
}
