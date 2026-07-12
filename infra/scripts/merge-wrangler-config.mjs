#!/usr/bin/env node
/**
 * base wrangler.toml + env overlay → single config for CI / wrangler CLI
 * Usage: node infra/scripts/merge-wrangler-config.mjs <staging|production>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const env = process.argv[2];
if (!env || !["staging", "production"].includes(env)) {
  console.error("Usage: node infra/scripts/merge-wrangler-config.mjs <staging|production>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const basePath = join(root, "wrangler.toml");
const overlayPath = join(root, `infra/generated/wrangler.${env}.toml`);
const mergedPath = join(root, `infra/generated/wrangler.${env}.merged.toml`);

const base = readFileSync(basePath, "utf8").trimEnd();
const overlay = readFileSync(overlayPath, "utf8");

writeFileSync(mergedPath, `${base}\n\n${overlay}`, "utf8");
console.log(`Wrote ${mergedPath}`);
