'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Flame } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/dashboard'); router.refresh();
  };

  return (
    <div className="min-h-screen bg-dragon-dark bg-scales flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-fire-glow pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <Flame className="h-10 w-10 text-fire-500 animate-fire-pulse" />
            <span className="text-xl font-bold text-white">RA Solution</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-obsidian-500">Sign in to your store</p>
        </div>
        <div className="d-card p-8">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="d-label">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="d-input" placeholder="you@store.com" />
            </div>
            <div>
              <label className="d-label">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} className="d-input pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-obsidian-500 hover:text-obsidian-300">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-fire-400 bg-fire-950/50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-fire w-full py-2.5">
              {loading ? 'Signing in…' : <><span>Sign in</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-obsidian-500">
          No account? <Link href="/register" className="text-fire-400 hover:text-fire-300 font-medium">Create one free</Link>
        </p>
      </div>
    </div>
  );
}
