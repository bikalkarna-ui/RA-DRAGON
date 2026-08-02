import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

const BASE_URL = 'https://ryxsorai.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'RYXSOR AI — Smart Store Manager for Gas Stations & C-Stores',
    template: '%s · RYXSOR AI',
  },
  description:
    'RYXSOR AI is an AI-powered gas station and convenience store management platform. Auto-read daily reports, track inventory, manage employees, and generate P&L — built on top of your Modisoft POS.',
  keywords: [
    'gas station management software',
    'convenience store management',
    'Modisoft POS integration',
    'AI inventory management',
    'daily report scanner',
    'store P&L',
    'c-store POS',
    'fuel margin tracking',
  ],
  authors: [{ name: 'RA' }],
  creator: 'RA',
  publisher: 'RYXSOR AI',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'RYXSOR AI',
    title: 'RYXSOR AI — Smart Store Manager for Gas Stations & C-Stores',
    description:
      'Upload your daily report and AI automatically handles your P&L, inventory, ordering, and invoices. Built specifically for gas stations and convenience stores.',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'RYXSOR AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RYXSOR AI — Smart Store Manager',
    description:
      'AI-powered gas station and convenience store management. Auto-read reports, track inventory, manage employees — built on top of your Modisoft POS.',
    images: ['/icon-512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C0392B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          });
        }
      `}} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
