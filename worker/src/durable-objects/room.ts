import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";

type ChatMessage = {
  id: string;
  from: string;
  text: string;
  ts: number;
};

type Attachment = {
  identity: string;
  name: string;
  isHost: boolean;
  room?: string;
};

export class RoomDO extends DurableObject<Env> {
  private viewers = new Map<string, string>();
  private hostTrackName: string | null = null;
  private chat: ChatMessage[] = [];
  private roomSlug: string | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/internal/state") {
      return Response.json({
        viewers: this.viewers.size,
        hostTrackName: this.hostTrackName,
      });
    }

    if (url.pathname === "/internal/host-track" && request.method === "POST") {
      const body = (await request.json()) as { trackName?: string };
      this.hostTrackName = body.trackName ?? null;
      return Response.json({ ok: true });
    }

    if (url.pathname === "/internal/stream-ended" && request.method === "POST") {
      this.hostTrackName = null;
      this.broadcast(JSON.stringify({ type: "stream_ended" }));
      return Response.json({ ok: true });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === "join" && typeof data.identity === "string") {
      if (typeof data.room === "string") this.roomSlug = data.room;
      const attachment: Attachment = {
        identity: data.identity,
        name: typeof data.name === "string" ? data.name : data.identity,
        isHost: data.isHost === true,
        room: typeof data.room === "string" ? data.room : undefined,
      };
      ws.serializeAttachment(attachment);
      if (!attachment.isHost) {
        this.viewers.set(attachment.identity, attachment.name);
      }
      ws.send(JSON.stringify({ type: "viewers", count: this.viewers.size }));
      ws.send(JSON.stringify({ type: "chat_history", messages: this.chat.slice(-200) }));
      ws.send(JSON.stringify({ type: "participants", list: this.listParticipants(attachment.identity) }));
      if (this.hostTrackName) {
        ws.send(JSON.stringify({ type: "host_track", trackName: this.hostTrackName }));
      }
      await this.syncViewerCount();
      this.broadcastParticipants();
      return;
    }

    if (data.type === "chat" && typeof data.text === "string") {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment) return;
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        from: attachment.name,
        text: data.text.slice(0, 500),
        ts: Date.now(),
      };
      this.chat.push(msg);
      if (this.chat.length > 200) this.chat.shift();
      this.broadcast(JSON.stringify({ type: "chat", message: msg }), ws);
      return;
    }

    if (data.type === "reaction" && (data.reactionType === "like" || data.reactionType === "gift")) {
      this.broadcast(message, ws);
    }

    if (data.type === "kick" && typeof data.target === "string") {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment?.isHost) return;
      this.broadcast(JSON.stringify({ type: "kick", target: data.target }));
    }
  }

  async webSocketClose(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment && !attachment.isHost) {
      this.viewers.delete(attachment.identity);
      this.broadcast(JSON.stringify({ type: "viewers", count: this.viewers.size }));
      await this.syncViewerCount();
      this.broadcastParticipants();
    }
  }

  private listParticipants(excludeIdentity?: string) {
    const list: Array<{ identity: string; name: string }> = [];
    for (const [identity, name] of this.viewers.entries()) {
      if (identity !== excludeIdentity) list.push({ identity, name });
    }
    return list;
  }

  private broadcastParticipants() {
    this.broadcast(JSON.stringify({ type: "participants", list: this.listParticipants() }));
  }

  private broadcast(payload: string, except?: WebSocket) {
    for (const peer of this.ctx.getWebSockets()) {
      if (peer !== except) peer.send(payload);
    }
  }

  private async syncViewerCount() {
    if (!this.roomSlug) return;
    await this.env.KV.put(`room:viewers:${this.roomSlug}`, String(this.viewers.size), {
      expirationTtl: 120,
    });
  }
}
