export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSec);
  const kvKey = `rl:${key}:${bucket}`;
  const current = Number(await kv.get(kvKey)) || 0;
  if (current >= limit) return false;
  await kv.put(kvKey, String(current + 1), { expirationTtl: windowSec * 2 });
  return true;
}
