'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin/mentions', label: '📈 提股管理' },
  { href: '/admin/commentary', label: '📝 法說會點評' },
  { href: '/admin/gurus', label: '🧠 大神追蹤' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #333',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          height: 48,
          gap: 4,
        }}
      >
        <span style={{ color: '#888', fontSize: 12, marginRight: 12, whiteSpace: 'nowrap' }}>
          後台管理：
        </span>
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              style={{
                color: isActive ? '#fff' : '#aaa',
                textDecoration: 'none',
                padding: '4px 10px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #e8b84b' : '2px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ paddingTop: 48 }}>
        {children}
      </div>
    </>
  );
}
