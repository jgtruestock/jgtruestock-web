'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav
      style={{
        background: '#FAFAF8',
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
      <Link href="/" style={{ textDecoration: 'none' }}>
        <span
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontWeight: 700,
            fontSize: 18,
            color: '#1A1A1A',
            letterSpacing: 0.3,
          }}
        >
          JG<span style={{ color: '#D93025' }}>True</span>Stock
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        <NavLink href="/">每日分享</NavLink>
        <NavLink href="/stocks">提股記錄</NavLink>
        {session && <NavLink href="/admin">後台管理</NavLink>}
        {session && <NavLink href="/admin/mentions">提股</NavLink>}
        {session && <NavLink href="/admin/commentary">法說會</NavLink>}
        {session && <NavLink href="/admin/gurus">大神追蹤</NavLink>}
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
              fontSize: 13,
              color: '#D93025',
              textDecoration: 'none',
              border: '1px solid #D93025',
              padding: '4px 14px',
              fontWeight: 500,
            }}
          >
            登入
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 13,
        color: '#444',
        textDecoration: 'none',
        fontWeight: 500,
      }}
    >
      {children}
    </Link>
  );
}
