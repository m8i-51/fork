import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import TwitterProvider from "next-auth/providers/twitter";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0",
      authorization: {
        params: {
          // Twitterのユーザー情報取得には tweet.read も要求される場合がある
          scope: "tweet.read users.read",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.provider = account.provider;
        // use provider ID as stable identity base
        token.sub = token.sub || (profile as any).sub || account.providerAccountId;
        token.name = token.name || (profile as any).name || token.name;
        token.picture = token.picture || (profile as any).picture || token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).userId = token.sub;
        const user = (session.user ?? {}) as any;
        user.name = user.name ?? (token.name as string | undefined) ?? "";
        user.image = user.image ?? (token.picture as string | undefined) ?? undefined;
        session.user = user;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export default handler;
