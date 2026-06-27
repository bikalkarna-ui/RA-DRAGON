'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft, Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
      if (error) {
        if (error.message.includes('Invalid login') || error.message.includes('invalid_credentials')) {
          setErr('Wrong email or password. Please try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setErr('Please confirm your email first — check your inbox.');
        } else {
          setErr(error.message);
        }
        return;
      }
      router.push('/home');
      router.refresh();
    } catch (err: any) {
      setErr('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
          <ArrowLeft className="h-4 w-4" />Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm">

          <div className="mb-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white font-black text-2xl mb-5 shadow-red">R</div>
            <h1 className="text-2xl font-black text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-1 text-sm">Sign in to your store</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="lbl">Email address</label>
                <input
                  type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="inp" placeholder="you@store.com"
                />
              </div>
              <div>
                <label className="lbl">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required
                    value={pw} onChange={e => setPw(e.target.value)}
                    className="inp pr-12" placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-dim hover:text-sub">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-accent">
                  {err}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn btn-accent btn-full py-4 text-base">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="flex items-start gap-2 pt-1">
                <Shield className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400">
                  Your account is protected by Supabase secure authentication
                </p>
              </div>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/register" className="text-accent font-semibold hover:underline">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
