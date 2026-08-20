import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// TEMPORARY DEBUG ENDPOINT - remove after diagnosis
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  if (!token) {
    return NextResponse.json({ hasToken: false, message: 'No session' });
  }
  
  const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jgdady@gmail.com';
  
  const isDiscordAdmin = token.provider === 'discord' && token.sub === ADMIN_DISCORD_ID;
  const isGoogleAdmin = !!(token.email && (token.email as string).toLowerCase() === ADMIN_EMAIL.toLowerCase());
  
  return NextResponse.json({
    hasToken: true,
    provider: token.provider,
    email: token.email,
    subFirst5: token.sub ? (token.sub as string).slice(0, 5) + '...' : null,
    isDiscordAdmin,
    isGoogleAdmin,
    isAdmin: isDiscordAdmin || isGoogleAdmin,
    isYTMember: token.isYTMember,
    needsBinding: token.needsBinding,
    adminDiscordIdLength: ADMIN_DISCORD_ID.length,
  });
}
