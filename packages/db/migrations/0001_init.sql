CREATE TABLE IF NOT EXISTS rooms (
  name TEXT PRIMARY KEY,
  display_name TEXT,
  host_identity TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  host_last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bans (
  room_name TEXT NOT NULL,
  identity TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (room_name, identity)
);

CREATE TABLE IF NOT EXISTS reaction_aggregates (
  room_name TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_name, type)
);

CREATE TABLE IF NOT EXISTS admin_users (
  identity TEXT PRIMARY KEY
);
