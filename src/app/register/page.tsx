'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Check } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ store: '', email: '', pw: '' });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email: form.email, password: form.pw });
    if (error) { setErr(error.message); setLoading(false); return; }
    if (data.user && form.store) await sb.from('stores').insert({ owner_id: data.user.id, name: form.store });
    if (!data.session) { setDone(true); setLoading(false); return; }
    router.push('/home'); router.refresh();
  };

  if (done) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="tile max-w-sm w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15"><Check className="h-7 w-7 text-green-400" /></div>
        <h2 className="text-xl font-bold text-text mb-2">Check your email</h2>
        <p className="text-sub text-sm mb-6">Click the link in <b>{form.email}</b> to activate your account.</p>
        <Link href="/login" className="btn btn-ghost btn-full">Back to Login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white font-bold text-2xl shadow-glow">R</div>
          <h1 className="text-2xl font-bold text-text">Create account</h1>
          <p className="text-sub mt-1 text-sm">Free 14-day trial</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="lbl">Store name</label><input required value={form.store} onChange={e => f('store', e.target.value)} className="inp" placeholder="Quick Stop Convenience" /></div>
          <div><label className="lbl">Email</label><input type="email" required value={form.email} onChange={e => f('email', e.target.value)} className="inp" placeholder="you@store.com" /></div>
          <div><label className="lbl">Password (min 6)</label><input type="password" required minLength={6} value={form.pw} onChange={e => f('pw', e.target.value)} className="inp" placeholder="••••••••" /></div>
          {err && <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-sm text-accent">{err}</div>}
          <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4 mt-2">{loading ? 'Creating…' : 'Create Account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">Have an account? <Link href="/login" className="text-accent font-medium hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
