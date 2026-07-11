import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("RoomDO", () => {
  it("returns viewer count of zero initially", async () => {
    const id = env.ROOM.idFromName("test-room");
    const stub = env.ROOM.get(id);
    const res = await stub.fetch("https://do/internal/state");
    expect(res.status).toBe(200);
    const body = await res.json<{ viewers: number; hostTrackName: string | null }>();
    expect(body.viewers).toBe(0);
    expect(body.hostTrackName).toBeNull();
  });
});
