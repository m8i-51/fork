export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export type SfuCallbacks = {
  onConnectionState?: (state: ConnectionState) => void;
  onRemoteAudio?: (track: MediaStreamTrack) => void;
  onError?: (message: string) => void;
};

export class SfuAudioClient {
  private pc: RTCPeerConnection | null = null;
  private sessionId: string | null = null;
  private localTrackName: string | null = null;
  private micStream: MediaStream | null = null;
  private state: ConnectionState = "idle";

  constructor(private readonly callbacks: SfuCallbacks = {}) {}

  get connectionState(): ConnectionState {
    return this.state;
  }

  private setState(state: ConnectionState) {
    this.state = state;
    this.callbacks.onConnectionState?.(state);
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    });
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          this.setState("connected");
          break;
        case "connecting":
          this.setState("connecting");
          break;
        case "disconnected":
        case "failed":
          this.setState("disconnected");
          break;
        default:
          break;
      }
    };
    pc.ontrack = (ev) => {
      if (ev.track.kind === "audio") this.callbacks.onRemoteAudio?.(ev.track);
    };
    return pc;
  }

  async joinAsHost(room: string): Promise<{ trackName: string }> {
    this.setState("connecting");
    const session = await this.newSession(room, true);
    this.sessionId = session.sessionId;
    this.pc = this.createPeerConnection();

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of this.micStream.getAudioTracks()) {
      this.pc.addTrack(track, this.micStream);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const publish = await fetch("/api/session/publish", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        room,
        sdpOffer: offer.sdp,
      }),
    });
    if (!publish.ok) throw new Error(`publish failed: ${publish.status}`);
    const pub = (await publish.json()) as {
      trackName: string;
      sessionDescription?: { type: RTCSdpType; sdp: string };
    };
    this.localTrackName = pub.trackName;
    if (pub.sessionDescription) {
      await this.pc.setRemoteDescription(pub.sessionDescription);
    }
    return { trackName: pub.trackName };
  }

  async joinAsViewer(room: string, hostTrackName: string): Promise<void> {
    this.setState("connecting");
    const session = await this.newSession(room, false);
    this.sessionId = session.sessionId;
    this.pc = this.createPeerConnection();
    this.pc.addTransceiver("audio", { direction: "recvonly" });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const sub = await fetch("/api/session/subscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        trackName: hostTrackName,
        sdpOffer: offer.sdp,
      }),
    });
    if (!sub.ok) throw new Error(`subscribe failed: ${sub.status}`);
    const body = (await sub.json()) as { sessionDescription: { type: RTCSdpType; sdp: string } };
    await this.pc.setRemoteDescription(body.sessionDescription);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await fetch("/api/session/renegotiate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId, sdpAnswer: answer.sdp }),
    });
  }

  setMicEnabled(enabled: boolean): void {
    for (const track of this.micStream?.getAudioTracks() ?? []) {
      track.enabled = enabled;
    }
  }

  async disconnect(room?: string): Promise<void> {
    const sessionId = this.sessionId;
    const trackNames = this.localTrackName ? [this.localTrackName] : [];
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.pc?.close();
    this.pc = null;
    this.sessionId = null;
    this.localTrackName = null;
    this.setState("disconnected");
    if (sessionId) {
      await fetch("/api/session/close", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, trackNames, room }),
      }).catch(() => undefined);
    }
  }

  private async newSession(room: string, publish: boolean) {
    const res = await fetch("/api/session/new", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, publish }),
    });
    if (!res.ok) throw new Error(`session/new failed: ${res.status}`);
    return res.json() as Promise<{
      sessionId: string;
      role: "host" | "viewer";
      canPublish: boolean;
      hostTrackName: string | null;
    }>;
  }
}
