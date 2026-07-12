export async function releaseStaleHosts(db: D1Database, thresholdSec = 90): Promise<number> {
  const cutoff = new Date(Date.now() - thresholdSec * 1000).toISOString();
  const result = await db
    .prepare(
      `UPDATE rooms
       SET host_identity = NULL, host_last_seen_at = NULL
       WHERE host_identity IS NOT NULL AND (host_last_seen_at IS NULL OR host_last_seen_at < ?)`,
    )
    .bind(cutoff)
    .run();
  return result.meta.changes ?? 0;
}

export async function touchHost(db: D1Database, roomName: string, identity: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE rooms SET host_last_seen_at = ? WHERE name = ? AND host_identity = ?`)
    .bind(now, roomName, identity)
    .run();
}

export async function clearHost(db: D1Database, roomName: string, identity: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE rooms SET host_identity = NULL, host_last_seen_at = NULL
       WHERE name = ? AND host_identity = ?`,
    )
    .bind(roomName, identity)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
