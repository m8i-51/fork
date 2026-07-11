import type { Env } from "../env";

const SFU_BASE = "https://rtc.live.cloudflare.com/v1";

function authHeader(secret: string): string {
  return `Bearer ${secret}`;
}

export function sfuConfigured(env: Env): boolean {
  return Boolean(env.REALTIME_APP_ID && env.REALTIME_APP_SECRET);
}

export async function createSfuSession(env: Env): Promise<string> {
  const appId = env.REALTIME_APP_ID!;
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/new`, {
    method: "POST",
    headers: {
      Authorization: authHeader(env.REALTIME_APP_SECRET!),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    throw new Error(`SFU session create failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { sessionId?: string };
  if (!json.sessionId) throw new Error("SFU sessionId missing");
  return json.sessionId;
}

type TrackResult = {
  trackName: string;
  mid?: string;
  sessionDescription?: { type: string; sdp: string };
};

export async function addLocalAudioTrack(
  env: Env,
  sessionId: string,
  sdpOffer: string,
): Promise<TrackResult> {
  const appId = env.REALTIME_APP_ID!;
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/${sessionId}/tracks/new`, {
    method: "POST",
    headers: {
      Authorization: authHeader(env.REALTIME_APP_SECRET!),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionDescription: { type: "offer", sdp: sdpOffer },
      tracks: [{ location: "local", trackName: "microphone", kind: "audio" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`SFU publish track failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { tracks?: TrackResult[]; sessionDescription?: { type: string; sdp: string } };
  const track = json.tracks?.[0];
  if (!track?.trackName) throw new Error("SFU trackName missing");
  return {
    trackName: track.trackName,
    mid: track.mid,
    sessionDescription: json.sessionDescription ?? track.sessionDescription,
  };
}

export async function pullRemoteTrack(
  env: Env,
  sessionId: string,
  trackName: string,
  sdpOffer: string,
): Promise<{ sessionDescription: { type: string; sdp: string }; trackName: string }> {
  const appId = env.REALTIME_APP_ID!;
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/${sessionId}/tracks/new`, {
    method: "POST",
    headers: {
      Authorization: authHeader(env.REALTIME_APP_SECRET!),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionDescription: { type: "offer", sdp: sdpOffer },
      tracks: [{ location: "remote", trackName, sessionId }],
    }),
  });
  if (!res.ok) {
    throw new Error(`SFU pull track failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    sessionDescription?: { type: string; sdp: string };
    tracks?: Array<{ trackName: string }>;
  };
  if (!json.sessionDescription) throw new Error("SFU answer missing");
  return {
    sessionDescription: json.sessionDescription,
    trackName: json.tracks?.[0]?.trackName ?? trackName,
  };
}

export async function renegotiate(
  env: Env,
  sessionId: string,
  sdpAnswer: string,
): Promise<void> {
  const appId = env.REALTIME_APP_ID!;
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/${sessionId}/renegotiate`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(env.REALTIME_APP_SECRET!),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionDescription: { type: "answer", sdp: sdpAnswer } }),
  });
  if (!res.ok) {
    throw new Error(`SFU renegotiate failed: ${res.status} ${await res.text()}`);
  }
}

export async function closeTracks(
  env: Env,
  sessionId: string,
  trackNames: string[],
): Promise<void> {
  if (trackNames.length === 0) return;
  const appId = env.REALTIME_APP_ID!;
  const res = await fetch(`${SFU_BASE}/apps/${appId}/sessions/${sessionId}/tracks/close`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(env.REALTIME_APP_SECRET!),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tracks: trackNames.map((trackName) => ({ trackName })),
    }),
  });
  if (!res.ok) {
    throw new Error(`SFU close tracks failed: ${res.status} ${await res.text()}`);
  }
}
