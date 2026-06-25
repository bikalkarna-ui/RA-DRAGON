'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { Check, Flame } from 'lucide-react';

export default function SettingsPage() {
  const { store, refetch } = useStore();
  const [form, setForm] = useState({ name:'', address:'', city:'', state:'', phone:'', email:'', tax_rate:'8.25' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (store) setForm({ name:store.name, address:store.address??'', city:store.city??'', state:store.state??'', phone:store.phone??'', email:store.email??'', tax_rate:String(Number(store.tax_rate)*100) });
  }, [store]);

  const f = (k:string, v:string) => setForm(p=>({...p,[k]:v}));

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return; setSaving(true);
    await createClient().from('stores').update({ name:form.name, address:form.address||null, city:form.city||null, state:form.state||null, phone:form.phone||null, email:form.email||null, tax_rate:parseFloat(form.tax_rate)/100 }).eq('id', store.id);
    await refetch(); setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  };

  return (
    <AppShell title="Settings" storeName={store?.name}>
      <div className="max-w-xl space-y-5">
        <div className="d-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Flame className="h-5 w-5 text-fire-500" />
            <h2 className="font-bold text-white">Store Information</h2>
          </div>
          <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {k:'name',label:'Store name *',req:true,full:true},
              {k:'phone',label:'Phone'},
              {k:'email',label:'Email',type:'email'},
              {k:'address',label:'Street address',full:true},
              {k:'city',label:'City'},
              {k:'state',label:'State'},
            ].map(field => (
              <div key={field.k} className={field.full?'sm:col-span-2':''}>
                <label className="d-label">{field.label}</label>
                <input required={field.req} type={field.type??'text'} value={(form as any)[field.k]} onChange={e=>f(field.k,e.target.value)} className="d-input" />
              </div>
            ))}
            <div>
              <label className="d-label">Tax rate (%)</label>
              <input type="number" step="0.01" min="0" max="50" value={form.tax_rate} onChange={e=>f('tax_rate',e.target.value)} className="d-input" />
              <p className="mt-1 text-xs text-obsidian-600">Applied at POS to taxable items. Current: {form.tax_rate}%</p>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className="btn-fire">
                {saved ? <><Check className="h-4 w-4"/>Saved!</> : saving ? 'Saving…' : <><Check className="h-4 w-4"/>Save changes</>}
              </button>
            </div>
          </form>
        </div>

        <div className="d-card p-6">
          <h2 className="font-bold text-white mb-4">Current Plan</h2>
          <div className="rounded-xl border border-fire-800/50 bg-fire-950/20 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white capitalize">{store?.plan ?? 'Starter'}</p>
              <p className="text-xs text-obsidian-500 mt-0.5">{store?.plan==='professional'?'$129.99/month':store?.plan==='enterprise'?'Custom pricing':'$49.99/month'}</p>
            </div>
            <Flame className="h-6 w-6 text-fire-500" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
