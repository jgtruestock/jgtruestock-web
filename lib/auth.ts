import { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

export const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).discordId = token.sub;
        (session.user as any).username = token.name;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = (profile as any).id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function isAdmin(discordId: string | undefined): boolean {
  if (!discordId || !ADMIN_DISCORD_ID) return false;
  return discordId === ADMIN_DISCORD_ID;
}
