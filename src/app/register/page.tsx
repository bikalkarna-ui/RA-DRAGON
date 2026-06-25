'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Flame, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ storeName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({ email: form.email, password: form.password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (data.user && form.storeName) await sb.from('stores').insert({ owner_id: data.user.id, name: form.storeName });
    if (!data.session) { setDone(true); setLoading(false); return; }
    router.push('/dashboard'); router.refresh();
  };

  if (done) return (
    <div className="min-h-screen bg-dragon-dark flex items-center justify-center px-4">
      <div className="d-card max-w-sm w-full p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fire-900/50">
          <Check className="h-7 w-7 text-fire-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-sm text-obsidian-400 mb-5">We sent a confirmation to <b className="text-white">{form.email}</b>. Click the link to activate, then log in.</p>
        <Link href="/login" className="btn-fire w-full py-2.5 justify-center">Back to login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-dragon-dark bg-scales flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-fire-glow pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <Flame className="h-10 w-10 text-fire-500 animate-fire-pulse" />
            <span className="text-xl font-bold text-white">RA Solution</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-obsidian-500">Free 14-day trial — no credit card needed</p>
        </div>
        <div className="d-card p-8">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="d-label">Store name</label>
              <input required value={form.storeName} onChange={e => f('storeName', e.target.value)} className="d-input" placeholder="Quick Stop Convenience" />
            </div>
            <div>
              <label className="d-label">Email</label>
              <input type="email" required value={form.email} onChange={e => f('email', e.target.value)} className="d-input" placeholder="you@store.com" />
            </div>
            <div>
              <label className="d-label">Password (min 6 characters)</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => f('password', e.target.value)} className="d-input" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-fire-400 bg-fire-950/50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-fire w-full py-2.5">
              {loading ? 'Creating account…' : <><span>Create account</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-obsidian-500">
          Already have an account? <Link href="/login" className="text-fire-400 hover:text-fire-300 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
