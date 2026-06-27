'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft, Shield, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });

      if (error) {
        // Show the real error message always
        const msg = error.message || JSON.stringify(error);
        if (msg === '{}' || msg === '') {
          setErr('Connection failed — check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel environment variables.');
        } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
          setErr('Wrong email or password. Click "Reset password" below if you forgot it.');
        } else if (msg.toLowerCase().includes('confirm')) {
          setErr('Please check your email and click the confirmation link to activate your account.');
        } else {
          setErr(msg);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        window.location.href = '/home';
      }
    } catch (ex: any) {
      setErr(ex?.message || 'Could not connect. Check your internet connection.');
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!email) { setErr('Enter your email address above, then click Reset.'); return; }
    setLoading(true); setErr('');
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/home',
      });
      if (error) { setErr(error.message); setLoading(false); return; }
      setResetSent(true);
    } catch (ex: any) { setErr(ex?.message || 'Reset failed'); }
    setLoading(false);
  };

  if (resetSent) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
      <div className="bg-white rounded-2xl border border-green-200 max-w-sm w-full p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Reset email sent!</h2>
        <p className="text-gray-500 text-sm mb-6">Check <b>{email}</b> for the reset link.</p>
        <button onClick={() => { setResetSent(false); setErr(''); }} className="btn btn-accent btn-full">
          Back to Sign In
        </button>
      </div>
    </div>
  );

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
                <label className="lbl">Email address</label>
                <input type="email" required autoFocus value={email}
                  onChange={e => setEmail(e.target.value)} className="inp" placeholder="you@store.com" />
              </div>
              <div>
                <label className="lbl">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required value={pw}
                    onChange={e => setPw(e.target.value)} className="inp pr-12" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {err && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 break-words">
                  {err}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4 text-base">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <button type="button" onClick={sendReset} disabled={loading}
                className="w-full text-center text-sm text-accent font-semibold hover:underline py-1">
                Forgot password? Reset it
              </button>

              <div className="flex items-center gap-2 pt-1">
                <Shield className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-400">Secured by Supabase authentication</p>
              </div>
            </form>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/register" className="text-accent font-semibold hover:underline">Start free trial</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
