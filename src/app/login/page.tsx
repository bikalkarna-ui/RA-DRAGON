'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft, Shield, Mail, CheckCircle, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'credentials' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep]       = useState<Step>('credentials');
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(300);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef  = useRef<NodeJS.Timeout>();

  // Countdown
  useEffect(() => {
    if (step !== 'otp') return;
    setCountdown(300); setCanResend(false);
    timerRef.current = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { clearInterval(timerRef.current); setCanResend(true); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Step 1: verify password is correct, then send OTP via magic link
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const sb = createClient();

      // Check password is correct first
      const { data, error: signInErr } = await sb.auth.signInWithPassword({ email, password: pw });
      if (signInErr) {
        setErr(signInErr.message.includes('Invalid') ? 'Wrong email or password.' : signInErr.message);
        return;
      }

      // Password correct — sign out and send OTP
      await sb.auth.signOut();

      // Use signInWithOtp — sends magic link + 6-digit code in email
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (otpErr) {
        // If OTP disabled in Supabase, fall back to password-only login
        if (otpErr.message.includes('not enabled') || otpErr.message.includes('Signups not allowed') || otpErr.status === 422) {
          // Re-login with password directly
          const { error: reLoginErr } = await sb.auth.signInWithPassword({ email, password: pw });
          if (reLoginErr) { setErr(reLoginErr.message); return; }
          setSuccess(true);
          await new Promise(r => setTimeout(r, 600));
          router.push('/home'); router.refresh();
          return;
        }
        setErr(`Could not send code: ${otpErr.message}`);
        return;
      }

      setStep('otp');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setErr(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // OTP input handling
  const handleOtp = (i: number, val: string) => {
    // Handle paste of full code
    if (val.length === 6 && /^\d+$/.test(val)) {
      const d = val.split('');
      setOtp(d); inputRefs.current[5]?.focus();
      verifyOtp(val); return;
    }
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
    if (digit && next.filter(Boolean).length === 6) verifyOtp(next.join(''));
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  // Step 2: verify the OTP code
  const verifyOtp = async (code?: string) => {
    const token = code ?? otp.join('');
    if (token.length !== 6) { setErr('Enter all 6 digits'); return; }
    if (countdown === 0)    { setErr('Code expired — request a new one'); return; }
    setErr(null); setLoading(true);
    try {
      const { error } = await createClient().auth.verifyOtp({ email, token, type: 'email' });
      if (error) {
        setErr('Wrong or expired code. Check your email or resend.');
        setLoading(false); return;
      }
      setSuccess(true);
      await new Promise(r => setTimeout(r, 700));
      router.push('/home'); router.refresh();
    } catch (err: any) {
      setErr(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!canResend) return;
    setErr(null); setLoading(true);
    setOtp(['', '', '', '', '', '']);
    try {
      const { error } = await createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) { setErr(error.message); return; }
      setCanResend(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) { setErr(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-5">
        {step === 'otp'
          ? <button onClick={() => { setStep('credentials'); setErr(null); setOtp(['','','','','','']); }}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
              <ArrowLeft className="h-4 w-4" />Back
            </button>
          : <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium">
              <ArrowLeft className="h-4 w-4" />Back to home
            </Link>
        }
      </div>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="mb-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white font-black text-2xl mb-5 shadow-red">R</div>
            {step === 'credentials'
              ? <><h1 className="text-2xl font-black text-gray-900">Welcome back</h1><p className="text-gray-500 mt-1 text-sm">Sign in to your store</p></>
              : <><h1 className="text-2xl font-black text-gray-900">Check your email</h1><p className="text-gray-500 mt-1 text-sm">6-digit code sent to<br /><span className="font-semibold text-gray-800">{email}</span></p></>
            }
          </div>

          {/* Step badge */}
          <div className="flex justify-center mb-5">
            <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              step === 'credentials' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700')}>
              <Lock className="h-3 w-3" />
              {step === 'credentials' ? 'Step 1 of 2 — Password' : 'Step 2 of 2 — Email verification'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-6">

            {/* ── CREDENTIALS ── */}
            {step === 'credentials' && (
              <form onSubmit={submitCredentials} className="space-y-4">
                <div>
                  <label className="lbl">Email address</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    className="inp" placeholder="you@store.com" autoFocus />
                </div>
                <div>
                  <label className="lbl">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required value={pw}
                      onChange={e => setPw(e.target.value)} className="inp pr-12" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dim hover:text-sub">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {err && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-accent">{err}</div>}
                {success && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center gap-2"><CheckCircle className="h-4 w-4" />Signed in! Taking you in…</div>}
                <button type="submit" disabled={loading}
                  className="btn btn-accent btn-full py-3.5">
                  {loading ? 'Checking…' : 'Continue →'}
                </button>
                <div className="flex items-start gap-2 pt-1">
                  <Shield className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-400">We verify your password then send a one-time code to your email for extra security</p>
                </div>
              </form>
            )}

            {/* ── OTP ── */}
            {step === 'otp' && (
              <div className="space-y-5">
                <div className="flex justify-center">
                  <div className={cn('flex h-16 w-16 items-center justify-center rounded-full', success ? 'bg-green-100' : 'bg-blue-50')}>
                    {success ? <CheckCircle className="h-8 w-8 text-green-600" /> : <Mail className="h-8 w-8 text-blue-500" />}
                  </div>
                </div>

                {success ? (
                  <p className="text-center font-black text-green-700 text-lg">Verified! Taking you in…</p>
                ) : (
                  <>
                    <div>
                      <label className="lbl text-center block mb-3">Enter the 6-digit code from your email</label>
                      <div className="flex gap-2 justify-center">
                        {otp.map((d, i) => (
                          <input key={i} ref={el => { inputRefs.current[i] = el; }}
                            type="text" inputMode="numeric" maxLength={6} value={d}
                            onChange={e => handleOtp(i, e.target.value)}
                            onKeyDown={e => handleKey(i, e)}
                            onFocus={e => e.target.select()}
                            onPaste={e => { e.preventDefault(); handleOtp(0, e.clipboardData.getData('text')); }}
                            className={cn('w-11 h-14 rounded-xl border-2 text-center text-2xl font-black transition-all outline-none',
                              d ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 focus:border-accent focus:bg-red-50')} />
                        ))}
                      </div>
                    </div>

                    {err && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-accent text-center">{err}</div>}

                    <div className="text-center">
                      {countdown > 0
                        ? <p className="text-sm text-gray-500">Code expires in <span className={cn('font-bold tabular-nums', countdown <= 60 ? 'text-accent' : 'text-gray-700')}>{fmt(countdown)}</span></p>
                        : <p className="text-sm text-accent font-semibold">Code expired — request a new one</p>}
                    </div>

                    <button onClick={() => verifyOtp()} disabled={loading || otp.join('').length !== 6}
                      className="btn btn-accent btn-full py-3.5">
                      {loading ? 'Verifying…' : 'Verify & Sign In'}
                    </button>

                    <div className="flex items-center justify-center gap-2">
                      <p className="text-sm text-gray-400">Didn't get it?</p>
                      <button onClick={resend} disabled={!canResend || loading}
                        className={cn('flex items-center gap-1.5 text-sm font-semibold',
                          canResend ? 'text-accent hover:underline' : 'text-gray-300 cursor-not-allowed')}>
                        <RefreshCw className="h-3.5 w-3.5" />Resend code
                      </button>
                    </div>

                    <p className="text-xs text-gray-400 text-center">Check your spam folder if you don't see it</p>
                  </>
                )}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            No account? <Link href="/register" className="text-accent font-semibold hover:underline">Start free trial</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
