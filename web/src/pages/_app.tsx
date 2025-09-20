import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import React from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";
import Head from "next/head";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <title>fork - Live Audio MVP</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="音声ライブ配信の最小実装" />
        <link rel="stylesheet" href="https://unpkg.com/@livekit/components-styles@latest/dist/styles.css" />
      </Head>
      <main>
        <Component {...pageProps} />
      </main>
      <Analytics />
      <SpeedInsights />
    </SessionProvider>
  );
}
