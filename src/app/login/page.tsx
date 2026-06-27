'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft, Shield } from 'lucide-react';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
      if (error) { setErr(error.message); setLoading(false); return; }
      window.location.href = '/home';
    } catch { setErr('Something went wrong.'); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
          <ArrowLeft className="h-4 w-4" />Back
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white font-black text-2xl mb-5">R</div>
            <h1 className="text-2xl font-black text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your store</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="lbl">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="inp" placeholder="you@store.com" autoFocus />
              </div>
              <div>
                <label className="lbl">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} className="inp pr-12" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{err}</p>}
              <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs text-gray-400">Secured by Supabase authentication</p>
              </div>
            </form>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500">
            No account? <Link href="/register" className="text-accent font-semibold">Start free trial</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
