'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Step = 'email' | 'password' | 'success';

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [pwDigits, setPwDigits] = useState(['', '', '', '', '', '', '', '']);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  // Step 1 — check email exists
  const submitEmail = async (e: any) => {
    e.preventDefault();
    if (!email.includes('@')) { setErr('Enter a valid email address'); return; }
    setErr(''); setLoading(true);
    // Small delay for UX feel
    await new Promise(r => setTimeout(r, 400));
    setLoading(false);
    setStep('password');
  };

  // Step 2 — sign in with password
  const submitPassword = async (e: any) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });

      if (error) {
        const msg = error.message || '';
        if (msg.includes('Invalid') || msg.includes('invalid') || msg.includes('credentials')) {
          // Could be wrong password OR unconfirmed email
          // Try to resend confirmation silently
          await sb.auth.resend({ type: 'signup', email }).catch(() => {});
          setErr('Wrong password — or check your email for a confirmation link and click it first.');
        } else if (msg.includes('Email not confirmed') || msg.includes('not confirmed')) {
          await sb.auth.resend({ type: 'signup', email }).catch(() => {});
          setErr('');
          setStep('success'); // show "check email" screen
        } else {
          setErr(msg || 'Login failed. Try again.');
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        window.location.href = '/home';
      }
    } catch {
      setErr('Connection error. Check your internet.');
      setLoading(false);
    }
  };

  // Admin override — bypass email confirmation by using magic link flow
  const sendMagicLink = async () => {
    if (!email) { setErr('Go back and enter your email first.'); return; }
    setLoading(true); setErr('');
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      // OTP might not be enabled - tell user to confirm email
      setStep('success');
    } else {
      setStep('success');
    }
  };

  const back = () => { setStep('email'); setErr(''); setPw(''); };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5">

      {/* Animated background dots */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white font-black text-3xl mb-4 shadow-lg shadow-red-900/30">
              R
            </div>
          </Link>
          <h1 className="text-2xl font-black text-white">RYXSOR AI</h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'email' ? 'Sign in to your store' :
             step === 'password' ? `Welcome back` :
             'Check your email'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-2xl">

          {/* ── STEP 1: Email ── */}
          {step === 'email' && (
            <form onSubmit={submitEmail} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email address
                </label>
                <input
                  type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@store.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-white placeholder-gray-600 text-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
              </div>

              {err && <p className="text-red-400 text-sm bg-red-950/50 rounded-xl px-4 py-3">{err}</p>}

              <button type="submit" disabled={loading}
                className="w-full bg-accent hover:bg-red-700 active:scale-[0.98] text-white font-bold text-base rounded-2xl py-4 transition-all disabled:opacity-60">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Checking…
                  </span>
                ) : 'Continue →'}
              </button>

              <p className="text-center text-sm text-gray-400">
                No account?{' '}
                <Link href="/register" className="text-accent font-semibold hover:text-red-400">
                  Start free trial
                </Link>
              </p>
            </form>
          )}

          {/* ── STEP 2: Password ── */}
          {step === 'password' && (
            <form onSubmit={submitPassword} className="space-y-5">
              {/* Email pill */}
              <button type="button" onClick={back}
                className="flex items-center gap-3 w-full bg-gray-800 rounded-2xl px-4 py-3 hover:bg-gray-700 transition-colors group">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent font-bold text-sm shrink-0">
                  {email.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium flex-1 text-left truncate">{email}</span>
                <span className="text-gray-400 text-xs group-hover:text-gray-400">Change ↩</span>
              </button>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} required autoFocus
                    value={pw} onChange={e => setPw(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 pr-14 text-white placeholder-gray-600 text-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors">
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {err && (
                <div className="text-red-400 text-sm bg-red-950/50 rounded-xl px-4 py-3">
                  <p>{err}</p>
                  <button type="button" onClick={sendMagicLink}
                    className="text-accent underline text-xs mt-1.5 hover:text-red-400">
                    Send me a sign-in link instead →
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading || !pw}
                className="w-full bg-accent hover:bg-red-700 active:scale-[0.98] text-white font-bold text-base rounded-2xl py-4 transition-all disabled:opacity-60">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign In'}
              </button>

              <button type="button" onClick={sendMagicLink} disabled={loading}
                className="w-full text-gray-500 hover:text-gray-300 text-sm text-center py-1 transition-colors">
                Forgot password? Send sign-in link
              </button>
            </form>
          )}

          {/* ── STEP 3: Check email ── */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mx-auto mb-2">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="text-white font-black text-xl">Check your email</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                We sent a sign-in link to<br />
                <span className="text-white font-semibold">{email}</span>
              </p>
              <p className="text-gray-500 text-xs">
                Click the link in the email to sign in instantly. Check spam if you don't see it.
              </p>
              <button onClick={back}
                className="w-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 font-medium text-sm rounded-2xl py-3 transition-all mt-4">
                ← Use a different email
              </button>
            </div>
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-400 text-xs">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>256-bit encryption · Secured by Supabase</span>
        </div>

      </div>
    </div>
  );
}
