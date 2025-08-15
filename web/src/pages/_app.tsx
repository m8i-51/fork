import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import React from "react";

import "./globals.css";
import Head from "next/head";

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Head>
        <link rel="stylesheet" href="https://unpkg.com/@livekit/components-styles@latest/dist/styles.css" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
