import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// TEMPORARY DEBUG ENDPOINT - remove after diagnosis
export const runtime = 'edge'; // Run in Edge Runtime like middleware

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  
  const ADMIN_DISCORD_ID = process.env.ADMIN_DISCORD_ID || '';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'jgdady@gmail.com';
  
  if (!token) {
    return NextResponse.json({ 
      hasToken: false, 
      message: 'No session',
      adminDiscordIdLength: ADMIN_DISCORD_ID.length,
      adminDiscordIdFirst5: ADMIN_DISCORD_ID.slice(0, 5),
      runtime: 'edge',
    });
  }
  
  const isDiscordAdmin = token.provider === 'discord' && token.sub === ADMIN_DISCORD_ID;
  const isGoogleAdmin = !!(token.email && (token.email as string).toLowerCase() === ADMIN_EMAIL.toLowerCase());
  
  return NextResponse.json({
    hasToken: true,
    provider: token.provider,
    email: token.email,
    subFirst5: token.sub ? (token.sub as string).slice(0, 5) + '...' : null,
    subLen: token.sub ? (token.sub as string).length : 0,
    isDiscordAdmin,
    isGoogleAdmin,
    isAdmin: isDiscordAdmin || isGoogleAdmin,
    isYTMember: token.isYTMember,
    adminDiscordIdLength: ADMIN_DISCORD_ID.length,
    adminDiscordIdFirst5: ADMIN_DISCORD_ID.slice(0, 5),
    runtime: 'edge',
  });
}
