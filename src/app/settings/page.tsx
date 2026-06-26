'use client';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { Check } from 'lucide-react';

export default function SettingsPage() {
  const { store, refetch } = useStore();
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '', tax_rate: '8.25' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  useEffect(() => { if (store) setForm({ name: store.name, address: store.address ?? '', city: store.city ?? '', state: store.state ?? '', phone: store.phone ?? '', email: store.email ?? '', tax_rate: String(Number(store.tax_rate) * 100) }); }, [store]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return; setSaving(true);
    await createClient().from('stores').update({ name: form.name, address: form.address || null, city: form.city || null, state: form.state || null, phone: form.phone || null, email: form.email || null, tax_rate: parseFloat(form.tax_rate) / 100 }).eq('id', store.id);
    await refetch(); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Screen title="Settings" subtitle="Store information and preferences">
      <form onSubmit={save} className="space-y-4">
        {[{ k: 'name', l: 'Store name', req: true }, { k: 'phone', l: 'Phone' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'address', l: 'Address' }, { k: 'city', l: 'City' }, { k: 'state', l: 'State' }].map(field => (
          <div key={field.k}><label className="lbl">{field.l}{field.req ? ' *' : ''}</label><input required={field.req} type={field.t ?? 'text'} value={(form as any)[field.k]} onChange={e => f(field.k, e.target.value)} className="inp" /></div>
        ))}
        <div>
          <label className="lbl">Tax rate (%)</label>
          <input type="number" step="0.01" min="0" max="50" value={form.tax_rate} onChange={e => f('tax_rate', e.target.value)} className="inp" />
          <p className="mt-1.5 text-xs text-muted">Applied at POS to taxable items</p>
        </div>
        <button type="submit" disabled={saving} className="btn btn-accent btn-full py-4">
          {saved ? <><Check className="h-5 w-5" />Saved!</> : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </Screen>
  );
}
