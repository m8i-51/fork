import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { LiveKitRoom } from '@livekit/components-react';
import { InRoomUI } from '@/components/InRoomUI';
import { signIn, useSession } from 'next-auth/react';

const WS_URL = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || '';

export default function RoomPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const slug = (router.query.name as string) || '';
  const publishQ = router.query.publish as string | undefined;
  const [token, setToken] = useState<string | null>(null);
  const [asHost, setAsHost] = useState<boolean>(publishQ !== 'false');
  const tokenRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPublishRef = useRef<boolean>(asHost);
  const [error, setError] = useState<string | null>(null);

  const decodeJwtExp = (tok: string): number | null => {
    try {
      const parts = tok.split('.');
      if (parts.length < 2) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof window === 'undefined' ? Buffer.from(base64, 'base64').toString('utf-8') : atob(base64);
      const payload = JSON.parse(json);
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch { return null; }
  };

  const clearTimers = () => { if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current); tokenRefreshTimer.current = null; };

  const fetchToken = async (room: string, wantPublish: boolean) => {
    setError(null);
    const q = new URLSearchParams({ room, publish: String(wantPublish) }).toString();
    let res: Response;
    try { res = await fetch(`/api/token?${q}`); } catch { setError('サーバに接続できません。'); return; }
    if (!res.ok) {
      if (res.status === 401) {
        try { await signIn(undefined, { callbackUrl: window.location.href }); } catch {}
        return;
      }
      setError(`トークン取得に失敗しました（${res.status}）。`);
      return;
    }
    const data = await res.json();
    if (data && typeof data.canPublish === 'boolean' && !data.canPublish) setAsHost(false);
    setToken(data.token);
    lastPublishRef.current = !!(data.canPublish ?? wantPublish);
    const exp = decodeJwtExp(data.token);
    if (exp) {
      const now = Math.floor(Date.now() / 1000);
      const lead = 60; // refresh 60s before expiry
      let ms = (exp - now - lead) * 1000;
      if (ms < 30000) ms = 30000;
      if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
      tokenRefreshTimer.current = setTimeout(() => { void refreshToken(); }, ms);
    }
  };

  const refreshToken = async () => {
    const room = slug.trim(); if (!room) return;
    try {
      const q = new URLSearchParams({ room, publish: String(lastPublishRef.current) }).toString();
      const r = await fetch(`/api/token?${q}`);
      if (!r.ok) return;
      const j = await r.json();
      if (j?.token) {
        setToken(j.token);
        lastPublishRef.current = !!(j.canPublish ?? lastPublishRef.current);
        const exp = decodeJwtExp(j.token);
        if (exp) {
          const now = Math.floor(Date.now() / 1000);
          const lead = 60;
          let ms = (exp - now - lead) * 1000; if (ms < 30000) ms = 30000;
          if (tokenRefreshTimer.current) clearTimeout(tokenRefreshTimer.current);
          tokenRefreshTimer.current = setTimeout(() => { void refreshToken(); }, ms);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (!router.isReady) return;
    if (!slug) return;
    void fetchToken(slug, asHost);
    return () => { clearTimers(); };
  }, [router.isReady, slug]);

  return (
    <div className="container">
      <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>fork</h1>
      {error && (<div className="card" style={{ marginBottom: 12, borderColor: 'var(--danger)', color: 'var(--danger)', fontSize: '14px' }}>{error}</div>)}
      {!WS_URL && (<p style={{ color: 'var(--danger)', fontSize: '14px' }}>NEXT_PUBLIC_LIVEKIT_WS_URL が未設定です。`.env.local`を確認してください。</p>)}
      {token && WS_URL && (
        <LiveKitRoom serverUrl={WS_URL} token={token} connect>
          <InRoomUI
            onLeave={() => { setToken(null); clearTimers(); router.replace('/'); }}
            onRejoin={async () => { setToken(null); setTimeout(() => { void fetchToken(slug, asHost); }, 0); }}
            isHost={asHost}
            roomName={slug}
          />
        </LiveKitRoom>
      )}
    </div>
  );
}

