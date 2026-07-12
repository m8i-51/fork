variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare Account ID (Dashboard → Workers → 右サイドバー)"
}

variable "environment" {
  type        = string
  description = "Environment name: staging | production"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "app_url" {
  type        = string
  description = "Public URL for OAuth callbacks (Workers *.workers.dev or custom domain)"
}

variable "d1_primary_location_hint" {
  type        = string
  description = "D1 primary region hint"
  default     = "apac"
}
