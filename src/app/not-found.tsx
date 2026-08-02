'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6">
        <Link href="/">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white font-black text-3xl mb-4 shadow-lg shadow-red-900/30">
            R
          </div>
        </Link>
      </div>
      <h1 className="text-6xl font-black text-white mb-2">404</h1>
      <p className="text-gray-400 text-lg mb-2">This page doesn't exist.</p>
      <p className="text-gray-600 text-sm mb-8 max-w-sm">
        The page you're looking for may have moved, or you might not have access to it yet.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-2xl bg-accent text-white font-bold text-base px-8 py-4 hover:bg-red-700 transition-colors"
      >
        <Home className="h-5 w-5" />
        Back to home
      </Link>
    </div>
  );
}
