'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, ArrowLeft, Shield, Mail, CheckCircle, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'credentials' | 'otp';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

export default function LoginPage() {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>('credentials');

  // Credentials
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [showPw, setShowPw] = useState(false);

  // OTP
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent]   = useState(false);
  const [countdown, setCountdown] = useState(OTP_EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef  = useRef<NodeJS.Timeout>();

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (step !== 'otp') return;
    setCountdown(OTP_EXPIRY_SECONDS);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, otpSent]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Step 1 — verify password then send OTP
  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const sb = createClient();

      // First verify password is correct
      const { error: signInErr } = await sb.auth.signInWithPassword({ email, password: pw });

      if (signInErr) {
        // Wrong password or email
        if (signInErr.message.includes('Invalid login')) {
          setErr('Incorrect email or password. Please try again.');
        } else if (signInErr.message.includes('Email not confirmed')) {
          setErr('Please confirm your email first — check your inbox.');
        } else {
          setErr(signInErr.message);
        }
        setLoading(false);
        return;
      }

      // Password correct — now sign them out temporarily and send OTP
      // (We'll re-authenticate after OTP is verified)
      await sb.auth.signOut();

      // Send OTP email
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // only existing users
          emailRedirectTo: undefined,
        },
      });

      if (otpErr) {
        setErr(`Could not send verification code: ${otpErr.message}`);
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setStep('otp');
      // Focus first OTP box
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setErr(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input — auto-advance and auto-submit
  const handleOtpInput = (index: number, value: string) => {
    // Allow paste of full 6-digit code
    if (value.length === 6 && /^\d+$/.test(value)) {
      const digits = value.split('');
      setOtp(digits);
      inputRefs.current[5]?.focus();
      submitOtp(digits.join(''));
      return;
    }

    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (digit && newOtp.filter(Boolean).length === 6) {
      submitOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  // Step 2 — verify OTP code
  const submitOtp = async (code?: string) => {
    const token = code ?? otp.join('');
    if (token.length !== 6) { setErr('Enter all 6 digits'); return; }
    if (countdown === 0) { setErr('Code expired — please request a new one'); return; }

    setErr(null);
    setLoading(true);

    try {
      const sb = createClient();
      const { error } = await sb.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        if (error.message.includes('expired') || error.message.includes('invalid')) {
          setErr('Wrong or expired code. Check your email or request a new code.');
        } else {
          setErr(error.message);
        }
        setLoading(false);
        return;
      }

      // OTP verified — user is now fully authenticated
      setSuccess(true);
      await new Promise(r => setTimeout(r, 800)); // brief success flash
      router.push('/home');
      router.refresh();
    } catch (err: any) {
      setErr(err.message || 'Verification failed');
      setLoading(false);
    }
  };

  // Resend OTP
  const resendOtp = async () => {
    if (!canResend) return;
    setErr(null);
    setLoading(true);
    setOtp(['', '', '', '', '', '']);

    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) { setErr(error.message); return; }
      setOtpSent(true);
      setCanResend(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-5">
        {step === 'otp' ? (
          <button onClick={() => { setStep('credentials'); setErr(null); setOtp(['','','','','','']); }}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        ) : (
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            <ArrowLeft className="h-4 w-4" />Back to home
          </Link>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm">

          {/* Logo + title */}
          <div className="mb-8 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white font-black text-2xl mb-5 shadow-red">R</div>
            {step === 'credentials' ? (
              <>
                <h1 className="text-2xl font-black text-gray-900">Welcome back</h1>
                <p className="text-gray-500 mt-1 text-sm">Sign in to your store</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-black text-gray-900">Check your email</h1>
                <p className="text-gray-500 mt-1 text-sm">
                  We sent a 6-digit code to<br />
                  <span className="font-semibold text-gray-800">{email}</span>
                </p>
              </>
            )}
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              step === 'credentials' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700')}>
              <Lock className="h-3 w-3" />
              {step === 'credentials' ? 'Step 1 of 2 — Password' : 'Step 2 of 2 — Verification'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-6">

            {/* ── STEP 1: Credentials ── */}
            {step === 'credentials' && (
              <form onSubmit={submitCredentials} className="space-y-4">
                <div>
                  <label className="lbl">Email address</label>
                  <input type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="inp" placeholder="you@store.com" autoFocus />
                </div>
                <div>
                  <label className="lbl">Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} required value={pw}
                      onChange={e => setPw(e.target.value)}
                      className="inp pr-12" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-dim hover:text-sub">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-accent">
                    {err}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="btn btn-accent btn-full py-3.5">
                  {loading ? 'Verifying…' : 'Continue →'}
                </button>

                <div className="flex items-center gap-2 pt-1">
                  <Shield className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <p className="text-xs text-gray-400">
                    After your password, we'll send a verification code to your email
                  </p>
                </div>
              </form>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 'otp' && (
              <div className="space-y-5">
                {/* Email icon */}
                <div className="flex justify-center">
                  <div className={cn('flex h-16 w-16 items-center justify-center rounded-full transition-all',
                    success ? 'bg-green-100' : 'bg-blue-50')}>
                    {success
                      ? <CheckCircle className="h-8 w-8 text-green-600" />
                      : <Mail className="h-8 w-8 text-blue-500" />}
                  </div>
                </div>

                {success ? (
                  <div className="text-center">
                    <p className="font-black text-green-700 text-lg">Verified!</p>
                    <p className="text-green-600 text-sm mt-1">Taking you to your store…</p>
                  </div>
                ) : (
                  <>
                    {/* OTP input boxes */}
                    <div>
                      <label className="lbl text-center block mb-3">Enter 6-digit code</label>
                      <div className="flex gap-2 justify-center">
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            onChange={e => handleOtpInput(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            onFocus={e => e.target.select()}
                            onPaste={e => {
                              e.preventDefault();
                              const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                              if (paste) handleOtpInput(0, paste);
                            }}
                            className={cn(
                              'w-11 h-14 rounded-xl border-2 text-center text-2xl font-black transition-all outline-none',
                              digit
                                ? 'border-accent bg-red-50 text-accent'
                                : 'border-gray-200 text-gray-900 focus:border-accent focus:bg-red-50'
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {err && (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-accent text-center">
                        {err}
                      </div>
                    )}

                    {/* Countdown */}
                    <div className="text-center">
                      {countdown > 0 ? (
                        <p className="text-sm text-gray-500">
                          Code expires in{' '}
                          <span className={cn('font-bold tabular-nums',
                            countdown <= 60 ? 'text-accent' : 'text-gray-700')}>
                            {formatTime(countdown)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-accent font-semibold">Code expired</p>
                      )}
                    </div>

                    <button
                      onClick={() => submitOtp()}
                      disabled={loading || otp.join('').length !== 6 || success}
                      className="btn btn-accent btn-full py-3.5">
                      {loading ? 'Verifying…' : 'Verify Code'}
                    </button>

                    {/* Resend */}
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-sm text-gray-400">Didn't get it?</p>
                      <button
                        onClick={resendOtp}
                        disabled={!canResend || loading}
                        className={cn('flex items-center gap-1.5 text-sm font-semibold transition-colors',
                          canResend ? 'text-accent hover:underline' : 'text-gray-300 cursor-not-allowed')}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Resend code
                      </button>
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                      Check your spam folder if you don't see it
                    </p>
                  </>
                )}
              </div>
            )}
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
