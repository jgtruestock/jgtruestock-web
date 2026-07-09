import { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import GoogleProvider from 'next-auth/providers/google';
import { getJgtDb } from './mongodb';

async function fetchYouTubeChannelId(
  accessToken: string
): Promise<{ channelId: string; channelName: string } | null> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.items?.length) return null;
    return {
      channelId: data.items[0].id,
      channelName: data.items[0].snippet?.title ?? '',
    };
  } catch { return null; }
}

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
          scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
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

      // Google member — look up by channel binding → yt_members (always re-check, not just on first sign-in)
      if (token.provider === 'google' || account?.provider === 'google') {
        const email = (token.email ?? '').toLowerCase();
        token.googleEmail = email;
        token.needsBinding = false;
        token.memberExpired = false;
        token.isYTMember = false;
        token.channelId = null;
        token.memberTier = null;

        if (email) {
          try {
            const db = await getJgtDb();
            const binding = await db.collection('user_bindings').findOne({ email });

            if (binding) {
              // 已綁定，確認是否還在 yt_members
              const member = await db.collection('yt_members').findOne({ channelId: binding.channelId });
              if (member) {
                token.isYTMember = true;
                token.channelId = binding.channelId;
                token.memberTier = member.tier ?? null;
              } else {
                token.memberExpired = true; // 曾是會員但名單已移除
              }
            } else if (account?.access_token) {
              // 首次登入 → 自動取 YouTube channel ID
              const ytChannel = await fetchYouTubeChannelId(account.access_token);
              if (ytChannel) {
                // 檢查是否已被其他帳號綁定
                const existingBinding = await db.collection('user_bindings')
                  .findOne({ channelId: ytChannel.channelId });

                if (existingBinding && existingBinding.email !== email) {
                  token.channelConflict = true;
                } else {
                  const member = await db.collection('yt_members')
                    .findOne({ channelId: ytChannel.channelId });

                  if (member) {
                    // 自動綁定！
                    if (!existingBinding) {
                      await db.collection('user_bindings').insertOne({
                        email,
                        channelId: ytChannel.channelId,
                        channelUrl: `https://www.youtube.com/channel/${ytChannel.channelId}`,
                        boundAt: new Date(),
                        verifiedBy: 'oauth-auto',
                      });
                    }
                    token.isYTMember = true;
                    token.channelId = ytChannel.channelId;
                  }
                  // 不是會員 → isYTMember 維持 false
                }
              } else {
                token.noYouTubeChannel = true;
              }
            } else {
              token.needsBinding = true; // 沒有 access_token（不應發生）
            }
          } catch (err) {
            console.error('auth binding lookup error:', err);
            token.needsBinding = true;
          }
        } else {
          token.needsBinding = true;
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
        (session.user as any).needsBinding = token.needsBinding;
        (session.user as any).memberExpired = token.memberExpired;
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
