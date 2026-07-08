'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <nav
      style={{
        background: '#f0f3f2',
        borderBottom: '1px solid #E0DCD6',
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
        <Image
          src="/jg-logo.png"
          alt="JGTrueStock"
          height={40}
          width={120}
          style={{ objectFit: 'contain', height: 40, width: 'auto' }}
          priority
        />
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        <NavLink href="/daily" active={pathname === '/daily'}>每日分享</NavLink>
        <NavLink href="/stocks" active={pathname?.startsWith('/stocks') ?? false}>提股記錄</NavLink>
      </div>

      {/* User / Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {session ? (
          <>
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt="avatar"
                width={28}
                height={28}
                style={{ borderRadius: '50%' }}
              />
            )}
            <span style={{ fontSize: 13, color: '#555' }}>
              {session.user?.name}
            </span>
            <button
              onClick={() => signOut()}
              style={{
                fontSize: 12,
                color: '#888',
                background: 'none',
                border: '1px solid #D5D0C8',
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              登出
            </button>
          </>
        ) : (
          <Link
            href="/login"
            style={{
              fontSize: 12,
              color: '#cc1a22',
              textDecoration: 'none',
              border: '1px solid #cc1a22',
              padding: '4px 14px',
              fontFamily: "'Raleway', sans-serif",
              fontWeight: 600,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            登入
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        fontFamily: "'Raleway', sans-serif",
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: active ? '#cc1a22' : '#444',
        textDecoration: 'none',
        borderBottom: active ? '2px solid #cc1a22' : '2px solid transparent',
        paddingBottom: 2,
        transition: 'color 0.15s',
      }}
    >
      {children}
    </Link>
  );
}
