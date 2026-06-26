'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password: pw });
    if (error) { setErr(error.message); setLoading(false); return; }
    router.push('/home'); router.refresh();
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white font-bold text-2xl shadow-glow">R</div>
          <h1 className="text-2xl font-bold text-text">Welcome back</h1>
          <p className="text-sub mt-1 text-sm">Sign in to your store</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="lbl">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="inp" placeholder="you@store.com" /></div>
          <div>
            <label className="lbl">Password</label>
            <div className="relative"><input type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)} className="inp pr-12" placeholder="••••••••" /><button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-sub">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          {err && <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-sm text-accent">{err}</div>}
          <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4 mt-2">{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">No account? <Link href="/register" className="text-accent font-medium hover:underline">Create one free</Link></p>
      </div>
    </div>
  );
}
