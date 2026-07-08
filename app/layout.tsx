import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import FeedbackPanel from '@/components/FeedbackPanel';

export const metadata: Metadata = {
  title: 'JGTrueStock',
  description: 'JG 提股記錄 — 真實投資，真實績效',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <SessionProvider>
          {children}
          <FeedbackPanel />
        </SessionProvider>
      </body>
    </html>
  );
}
