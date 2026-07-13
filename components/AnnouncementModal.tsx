'use client';
import { useEffect, useState } from 'react';

interface Announcement {
  _id: string;
  title: string;
  content: string;
  active: boolean;
}

export default function AnnouncementModal() {
  const [ann, setAnn] = useState<Announcement | null>(null);
  const [visible, setVisible] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);

  useEffect(() => {
    fetch('/api/announcement')
      .then(r => r.json())
      .then(data => {
        const a = data.announcement;
        if (!a || !a.active) return;
        const key = `jg_ann_seen_${a._id}`;
        if (!localStorage.getItem(key)) {
          setAnn(a);
          setVisible(true);
        }
      });
  }, []);

  function handleClose() {
    if (ann) localStorage.setItem(`jg_ann_seen_${ann._id}`, '1');
    setVisible(false);
  }

  if (!visible || !ann) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1a1a1a 0%, #111 100%)',
          border: '1px solid #2a2a2a',
          boxShadow: '0 0 0 1px rgba(201,168,76,0.12), 0 24px 72px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,168,76,0.08)',
          borderRadius: 16,
          maxWidth: 480,
          width: '100%',
          padding: '36px 32px 28px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#555',
            lineHeight: 1,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="關閉"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3l12 12M15 3L3 15" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Title */}
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            fontWeight: 900,
            color: '#c9a84c',
            marginBottom: 8,
            lineHeight: 1.35,
          }}
        >
          {ann.title}
        </h2>

        {/* Gold divider */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, #c9a84c 0%, rgba(201,168,76,0.15) 100%)',
            marginBottom: 24,
          }}
        />

        {/* Content */}
        <p
          style={{
            whiteSpace: 'pre-line',
            color: '#ccc',
            lineHeight: 1.8,
            fontSize: 14,
            marginBottom: 28,
          }}
        >
          {ann.content}
        </p>

        {/* CTA Button */}
        <button
          onClick={handleClose}
          style={{
            width: '100%',
            background: ctaHovered ? '#d4b05a' : '#c9a84c',
            color: '#0f0f0f',
            border: 'none',
            borderRadius: 10,
            padding: '14px 0',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Noto Sans TC', sans-serif",
            letterSpacing: 0.5,
            transition: 'background 0.15s',
            boxShadow: ctaHovered ? '0 4px 20px rgba(201,168,76,0.35)' : '0 2px 12px rgba(201,168,76,0.2)',
          }}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => setCtaHovered(false)}
        >
          好，知道了 →
        </button>
      </div>
    </div>
  );
}
