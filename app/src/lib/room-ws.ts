export type RoomWsMessage =
  | { type: "viewers"; count: number }
  | { type: "chat_history"; messages: Array<{ id: string; from: string; text: string; ts: number }> }
  | { type: "chat"; message: { id: string; from: string; text: string; ts: number } }
  | { type: "host_track"; trackName: string }
  | { type: "stream_ended" }
  | { type: "kick"; target: string }
  | { type: "participants"; list: Array<{ identity: string; name: string }> }
  | { type: "reaction"; reactionType: "like" | "gift" };

export type RoomWsHandlers = {
  onViewers?: (count: number) => void;
  onChatHistory?: (messages: Array<{ id: string; from: string; text: string; ts: number }>) => void;
  onChat?: (message: { id: string; from: string; text: string; ts: number }) => void;
  onHostTrack?: (trackName: string) => void;
  onStreamEnded?: () => void;
  onKick?: (target: string) => void;
  onReaction?: (type: "like" | "gift") => void;
  onParticipants?: (list: Array<{ identity: string; name: string }>) => void;
};

export function connectRoomWs(
  slug: string,
  identity: string,
  name: string,
  isHost: boolean,
  handlers: RoomWsHandlers,
): WebSocket {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/api/room/${encodeURIComponent(slug)}/ws`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "join", identity, name, room: slug, isHost }));
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as RoomWsMessage;
      switch (msg.type) {
        case "viewers":
          handlers.onViewers?.(msg.count);
          break;
        case "chat_history":
          handlers.onChatHistory?.(msg.messages);
          break;
        case "chat":
          handlers.onChat?.(msg.message);
          break;
        case "host_track":
          handlers.onHostTrack?.(msg.trackName);
          break;
        case "stream_ended":
          handlers.onStreamEnded?.();
          break;
        case "kick":
          handlers.onKick?.(msg.target);
          break;
        case "participants":
          handlers.onParticipants?.(msg.list);
          break;
        default:
          break;
      }
    } catch {
      /* ignore */
    }
  };
  return ws;
}

export function sendChat(ws: WebSocket, text: string): void {
  ws.send(JSON.stringify({ type: "chat", text }));
}

export function sendReaction(ws: WebSocket, reactionType: "like" | "gift"): void {
  ws.send(JSON.stringify({ type: "reaction", reactionType }));
}

export function sendKick(ws: WebSocket, target: string): void {
  ws.send(JSON.stringify({ type: "kick", target }));
}
