'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(''); setInfo(''); setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
    if (error) {
      setErr(error.message || 'Login failed — check your email and password');
      setLoading(false);
      return;
    }
    window.location.href = '/home';
  };

  const resetPassword = async () => {
    if (!email) { setErr('Type your email address above first.'); return; }
    setErr(''); setInfo(''); setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      // SMTP not set up - tell them to use Supabase dashboard
      setInfo('Email reset not configured. Go to Supabase → Authentication → Users → find your account → Send password reset email.');
    } else {
      setInfo('Password reset email sent! Check your inbox.');
    }
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

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="lbl">Email</label>
                <input type="email" required autoFocus value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="inp" placeholder="you@store.com" />
              </div>
              <div>
                <label className="lbl">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required value={pw}
                    onChange={e => setPw(e.target.value)}
                    className="inp pr-12" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {err && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{err}</div>}
              {info && <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">{info}</div>}

              <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <button onClick={resetPassword} disabled={loading}
              className="w-full text-center text-sm text-accent font-semibold hover:underline">
              Forgot password? Reset it
            </button>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/register" className="text-accent font-semibold">Start free trial</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
