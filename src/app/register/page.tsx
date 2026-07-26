'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(''); setLoading(true);

    if (pw.length < 8) {
      setErr('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
      setErr('Password must include at least one letter and one number.');
      setLoading(false);
      return;
    }

    try {
      const sb = createClient();
      const { data, error } = await sb.auth.signUp({
        email,
        password: pw,
        options: {
          // Store name is stashed here and only turned into a real store
          // once the user actually confirms their email — see /auth/callback.
          data: { store_name: store.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) { setErr(error.message); setLoading(false); return; }

      // If a session came back immediately, email confirmation is off for
      // this Supabase project — create the store right now since there's
      // no callback step coming.
      if (data.session && data.user) {
        const { data: existingStore } = await sb.from('stores').select('id').eq('owner_id', data.user.id).maybeSingle();
        if (!existingStore) {
          const { data: newStore, error: storeErr } = await sb.from('stores')
            .insert({ owner_id: data.user.id, name: store.trim() })
            .select('id').single();
          if (storeErr) {
            console.error('store creation failed:', storeErr);
            setErr(`Account created, but store setup failed: ${storeErr.message}. Please contact support.`);
            setLoading(false);
            return;
          }
          if (newStore) {
            const { error: vendorErr } = await sb.from('vendors').insert(
              VENDORS.map((v: string) => ({ store_id: newStore.id, company_name: v, is_preset: true }))
            );
            if (vendorErr) console.error('preset vendor creation failed (non-fatal):', vendorErr);
          }
        }
        window.location.href = '/home';
        return;
      }

      // Otherwise email confirmation is required — show "check email"
      setDone(true);
    } catch (ex: any) {
      setErr(ex?.message || 'Something went wrong.');
    }
    setLoading(false);
  };

  if (done) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-10">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-2xl font-black text-white mb-3">Check your email</h2>
          <p className="text-gray-400 text-sm mb-2">
            We sent a confirmation link to
          </p>
          <p className="text-white font-bold mb-6">{email}</p>
          <p className="text-gray-500 text-xs mb-8">
            Click the link to activate your account, then come back and sign in.
          </p>
          <Link href="/login" className="block w-full bg-accent text-white font-bold rounded-2xl py-4 hover:bg-red-700 transition-colors">
            Go to Sign In
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <Link href="/">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white font-black text-3xl mb-4 shadow-lg shadow-red-900/30">R</div>
          </Link>
          <h1 className="text-2xl font-black text-white">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Free to start · No credit card needed</p>
        </div>

        <div className="bg-gray-900 rounded-3xl border border-gray-800 p-8 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Store name</label>
              <input required value={store} onChange={e => setStore(e.target.value)}
                placeholder="Quick Stop Convenience"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-white placeholder-gray-600 text-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@store.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-white placeholder-gray-600 text-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password (min 6 characters)</label>
              <input type="password" required minLength={8} value={pw} onChange={e => setPw(e.target.value)}
                placeholder="At least 8 characters, with a letter and number"
                className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-5 py-4 text-white placeholder-gray-600 text-base focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
            </div>

            {err && <p className="text-red-400 text-sm bg-red-950/50 rounded-xl px-4 py-3">{err}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-accent hover:bg-red-700 active:scale-[0.98] text-white font-bold text-base rounded-2xl py-4 transition-all disabled:opacity-60 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Create Account →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-accent font-semibold hover:text-red-400">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
