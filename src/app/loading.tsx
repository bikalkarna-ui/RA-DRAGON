export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white font-black text-3xl shadow-lg shadow-red-900/30 mb-4">
        R
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="h-2 w-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.15s' }} />
        <div className="h-2 w-2 rounded-full bg-gray-600 animate-bounce" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  );
}
