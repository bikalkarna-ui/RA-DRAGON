'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Plus, Trash2, AlertTriangle, RefreshCw, Package } from 'lucide-react';

const TYPES = ['waste','expired','damaged','theft','returned','other'];
const EMPTY = { product_name:'', type:'waste', quantity:'1', unit_cost:'', notes:'' };

export default function ShrinkPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: ev }, { data: pr }] = await Promise.all([
      sb.from('shrink_events').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(100),
      sb.from('products').select('id,name,unit_cost').eq('store_id', store.id).eq('is_active', true).order('name'),
    ]);
    setEvents(ev || []);
    setProducts(pr || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !form.product_name) return;
    setSaving(true);
    const cost = parseFloat(form.unit_cost) || 0;
    const qty = parseFloat(form.quantity) || 1;
    await createClient().from('shrink_events').insert({
      store_id: store.id,
      product_name: form.product_name,
      type: form.type,
      quantity: qty,
      unit_cost: cost,
      total_cost: cost * qty,
      notes: form.notes || null,
    });
    setForm(EMPTY);
    setShowForm(false);
    load();
    setSaving(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete this shrink record?')) return;
    await createClient().from('shrink_events').delete().eq('id', id);
    load();
  };

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);
  const totalCost = events.reduce((s, e) => s + n(e.total_cost), 0);
  const thisMonth = events.filter(e => e.created_at >= new Date(Date.now()-30*86400000).toISOString());
  const monthCost = thisMonth.reduce((s, e) => s + n(e.total_cost), 0);

  return (
    <Screen title="Shrink & Waste" subtitle="Track expired, damaged, and stolen products"
      action={<button onClick={() => setShowForm(v => !v)} className={cn('btn text-sm h-9 px-4', showForm ? 'btn-ghost' : 'btn-accent')}><Plus className="h-4 w-4" />{showForm ? 'Cancel' : 'Log'}</button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="tile p-4 text-center border-l-4 border-l-red-400">
            <p className="text-xs text-muted">This Month</p>
            <p className="num font-black text-xl text-red-700">{fmt.currency(monthCost)}</p>
            <p className="text-xs text-muted">{thisMonth.length} items</p>
          </div>
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">All Time</p>
            <p className="num font-black text-xl text-text">{fmt.currency(totalCost)}</p>
            <p className="text-xs text-muted">{events.length} items</p>
          </div>
        </div>

        {showForm && (
          <div className="tile p-5">
            <p className="font-bold text-text mb-4">Log Shrink / Waste</p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="lbl">Product name *</label>
                <input list="products-list" value={form.product_name} onChange={e => f('product_name', e.target.value)} className="inp" placeholder="Type or select product…" autoFocus required />
                <datalist id="products-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Type</label>
                  <select value={form.type} onChange={e => f('type', e.target.value)} className="inp capitalize">
                    {TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Quantity</label>
                  <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="inp" />
                </div>
              </div>
              <div>
                <label className="lbl">Unit cost $</label>
                <input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" placeholder="0.00" />
                {form.unit_cost && form.quantity && <p className="text-xs text-accent mt-1">Total loss: {fmt.currency(parseFloat(form.unit_cost)*parseFloat(form.quantity))}</p>}
              </div>
              <div>
                <label className="lbl">Notes</label>
                <input value={form.notes} onChange={e => f('notes', e.target.value)} className="inp" placeholder="Reason, details…" />
              </div>
              <button type="submit" disabled={saving} className="btn btn-accent btn-full">
                {saving ? 'Saving…' : 'Log Shrink Event'}
              </button>
            </form>
          </div>
        )}

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}
        {!loading && events.length === 0 && (
          <div className="tile p-10 text-center"><Package className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted">No shrink events recorded</p></div>
        )}

        {events.length > 0 && (
          <div className="tile overflow-hidden divide-y divide-border/50">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-4">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm',
                  ev.type==='theft'?'bg-red-100 text-red-700':ev.type==='expired'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-600')}>
                  {ev.type==='theft'?'🚨':ev.type==='expired'?'⏰':ev.type==='waste'?'🗑':'📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{ev.product_name}</p>
                  <p className="text-xs text-muted capitalize">{ev.type} · qty {ev.quantity}{ev.notes ? ` · ${ev.notes}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="num font-bold text-red-600">{fmt.currency(n(ev.total_cost))}</p>
                  <p className="text-xs text-muted">{(() => { try { return new Date(ev.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}); } catch { return ''; } })()}</p>
                </div>
                <button onClick={() => del(ev.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted hover:text-accent hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
