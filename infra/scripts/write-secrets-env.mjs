#!/usr/bin/env node
/**
 * GitHub Actions 用: Secrets から wrangler secret bulk 用 .env を生成
 * Usage: node infra/scripts/write-secrets-env.mjs <staging|production>
 *
 * 環境変数が空のキーはスキップする
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const env = process.argv[2];
if (!env || !["staging", "production"].includes(env)) {
  console.error("Usage: node infra/scripts/write-secrets-env.mjs <staging|production>");
  process.exit(1);
}

const keys = [
  "REALTIME_APP_ID",
  "REALTIME_APP_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "TWITTER_CLIENT_ID",
  "TWITTER_CLIENT_SECRET",
];

const lines = keys
  .map((key) => [key, process.env[key]?.trim() ?? ""])
  .filter(([, value]) => value.length > 0)
  .map(([key, value]) => `${key}=${value}`);

const outPath = join(process.cwd(), `infra/secrets.${env}.env`);

if (lines.length === 0) {
  console.log("No Worker secrets in environment — skipping secret bulk.");
  process.exit(0);
}

writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${outPath} (${lines.length} keys)`);
