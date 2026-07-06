'use client';
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">📵</div>
      <h1 className="text-2xl font-black text-text mb-2">You're offline</h1>
      <p className="text-gray-500 mb-6">No internet connection. Your data is safe and will sync automatically when you reconnect.</p>
      <button onClick={() => window.location.reload()} className="btn btn-accent px-8 py-3">Try again</button>
    </div>
  );
}
