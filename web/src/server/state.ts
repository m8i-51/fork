// Simple in-memory state for MVP moderation/ownership
// Note: resets on server restart. Replace with DB for persistence.

export const hosts = new Map<string, string>(); // room -> host identity
export const bans = new Map<string, Set<string>>(); // room -> set(identity)

export function setHost(room: string, identity: string) {
  if (!hosts.has(room)) hosts.set(room, identity);
}

export function isBanned(room: string, identity: string) {
  const s = bans.get(room);
  return !!(s && s.has(identity));
}

export function addBan(room: string, identity: string) {
  let s = bans.get(room);
  if (!s) {
    s = new Set<string>();
    bans.set(room, s);
  }
  s.add(identity);
}

export function removeBan(room: string, identity: string) {
  const s = bans.get(room);
  if (s) s.delete(identity);
}

