import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'RA Solution — Inventory That Works', template: '%s | RA Solution' },
  description: 'Real-time inventory tracking, AI invoice scanning, smart ordering, and live sales — built for convenience stores that want to save time.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
