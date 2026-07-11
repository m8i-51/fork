import type { Env } from "../env";

export function genSlug(len = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function roomStub(env: Env, slug: string) {
  const id = env.ROOM.idFromName(slug);
  return env.ROOM.get(id);
}

export async function invalidateRoomListCache(kv: KVNamespace): Promise<void> {
  await kv.delete("room:list:public");
}
