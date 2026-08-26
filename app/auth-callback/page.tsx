'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    
    const user = session?.user as any;
    
    if (!session || status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    
    // Check admin status (email-based)
    const ADMIN_EMAIL = 'jgdady@gmail.com';
    const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL || user?.provider === 'discord';
    
    if (isAdmin || user?.isYTMember) {
      router.replace('/stocks');
    } else if (user?.memberExpired) {
      router.replace('/not-member');
    } else {
      // needsBinding or unknown → go to verify
      router.replace('/verify');
    }
  }, [status, session, router]);

  // Loading screen
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'oklch(0.18 0.01 65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid rgba(201,168,76,0.3)',
        borderTopColor: '#c9a84c',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{
        fontFamily: "'Noto Serif TC', serif",
        color: '#c9a84c',
        fontSize: 15,
        letterSpacing: '0.1em',
      }}>登入中...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
