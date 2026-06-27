'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Check, ArrowLeft } from 'lucide-react';
import { VENDORS } from '@/lib/utils';

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const [store, setStore] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5">
      <div className="bg-white rounded-2xl border border-gray-200 max-w-sm w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <Check className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-black text-gray-900 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-6">Click the link in <b>{email}</b> to activate your account.</p>
        <Link href="/login" className="btn btn-accent btn-full">Go to Login</Link>
      </div>
    </div>
  );

  const submit = async (e: any) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const sb = createClient();
      const { data, error } = await sb.auth.signUp({ email, password: pw });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (data.user) {
        const { data: newStore } = await sb.from('stores').insert({ owner_id: data.user.id, name: store }).select('id').single();
        if (newStore) {
          await sb.from('vendors').insert(VENDORS.map((v: string) => ({ store_id: newStore.id, company_name: v, is_preset: true })));
        }
      }
      if (!data.session) { setDone(true); setLoading(false); return; }
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
            <h1 className="text-2xl font-black text-gray-900">Create account</h1>
            <p className="text-gray-500 mt-1 text-sm">Free trial · No credit card needed</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="lbl">Store name</label>
                <input required value={store} onChange={e => setStore(e.target.value)} className="inp" placeholder="Quick Stop Convenience" autoFocus />
              </div>
              <div>
                <label className="lbl">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="inp" placeholder="you@store.com" />
              </div>
              <div>
                <label className="lbl">Password (min 6 characters)</label>
                <input type="password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} className="inp" placeholder="••••••••" />
              </div>
              {err && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{err}</p>}
              <button type="submit" disabled={loading} className="btn btn-accent btn-full py-4">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account? <Link href="/login" className="text-accent font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
