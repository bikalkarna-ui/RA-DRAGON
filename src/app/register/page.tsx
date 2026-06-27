'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Check, ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
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
    window.location.href = '/home'; ;
  };

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-card max-w-sm w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><Check className="h-7 w-7 text-green-600" /></div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-6">Click the link in <b>{form.email}</b> to activate your account.</p>
        <Link href="/login" className="btn-ghost btn-full">Back to Login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
          <ArrowLeft className="h-4 w-4" />Back to home
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-5 pb-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white font-black text-2xl mb-5 shadow-red">R</Link>
            <h1 className="text-2xl font-black text-gray-900">Create account</h1>
            <p className="text-gray-500 mt-1 text-sm">Free 14-day trial · No credit card</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-card p-6">
            <form onSubmit={submit} className="space-y-4">
              <div><label className="lbl">Store name</label><input required value={form.store} onChange={e => f('store', e.target.value)} className="inp" placeholder="Quick Stop Convenience" autoFocus /></div>
              <div><label className="lbl">Email</label><input type="email" required value={form.email} onChange={e => f('email', e.target.value)} className="inp" placeholder="you@store.com" /></div>
              <div><label className="lbl">Password (min 6)</label><input type="password" required minLength={6} value={form.pw} onChange={e => f('pw', e.target.value)} className="inp" placeholder="••••••••" /></div>
              {err && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-accent">{err}</div>}
              <button type="submit" disabled={loading} className="btn-accent btn-full py-3.5 mt-1 rounded-xl">{loading ? 'Creating…' : 'Create Account'}</button>
            </form>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-accent font-semibold hover:underline">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
