'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 mx-auto mb-6">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <h1 className="text-2xl font-black text-white mb-2">Something went wrong</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-sm">
        An unexpected error occurred. Try again, and if the problem persists, contact support at bikalkarna@gmail.com.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-2xl bg-accent text-white font-bold text-base px-8 py-4 hover:bg-red-700 transition-colors"
      >
        <RefreshCw className="h-5 w-5" />
        Try again
      </button>
    </div>
  );
}
