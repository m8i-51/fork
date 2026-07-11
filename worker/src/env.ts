import type { RoomDO } from "./durable-objects/room";

export type SessionUser = {
  userId: string;
  name: string;
  image?: string;
};

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  ROOM: DurableObjectNamespace<RoomDO>;
  ASSETS: Fetcher;
  APP_URL: string;
  REALTIME_APP_ID?: string;
  REALTIME_APP_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
};

export type AppVariables = {
  user: SessionUser;
};

export const SESSION_COOKIE = "__Host-fork-session";
export const SESSION_TTL = 60 * 60 * 24 * 7;
