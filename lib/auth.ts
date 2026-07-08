import { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import { getJgtDb } from './mongodb';

export const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Preserve provider info on first sign-in
      if (account) {
        token.provider = account.provider;
        token.accessToken = account.access_token;
      }

      // Discord admin
      if (account?.provider === 'discord' && profile) {
        token.sub = (profile as any).id;
      }

      // Google member — look up by googleEmail in yt_members
      if (account?.provider === 'google') {
        const googleEmail = token.email ?? null;
        token.googleEmail = googleEmail;

        if (googleEmail) {
          try {
            const db = await getJgtDb();
            const member = await db
              .collection('yt_members')
              .findOne({ googleEmail: { $regex: new RegExp(`^${googleEmail}$`, 'i') } });
            if (member) {
              token.isYTMember = true;
              token.memberTier = member.tier;
              token.channelId = member.channelId ?? null;
            } else {
              token.isYTMember = false;
              token.memberTier = null;
              token.channelId = null;
            }
          } catch (err) {
            console.error('yt_members lookup error:', err);
            token.isYTMember = false;
            token.memberTier = null;
            token.channelId = null;
          }
        } else {
          token.isYTMember = false;
          token.memberTier = null;
          token.channelId = null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).discordId =
          token.provider === 'discord' ? token.sub : undefined;
        (session.user as any).username = token.name;
        (session.user as any).provider = token.provider;
        (session.user as any).channelId = token.channelId;
        (session.user as any).isYTMember = token.isYTMember;
        (session.user as any).memberTier = token.memberTier;
      }
      return session;
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
