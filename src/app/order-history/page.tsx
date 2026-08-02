'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { fmt, cn } from '@/lib/utils';
import { Plus, RefreshCw, Package, AlertTriangle, CheckCircle2, FileText, Brain, PencilLine } from 'lucide-react';

const DEPARTMENTS = ['Tobacco/CIG','Beer & Wine','Snacks','Beverages','Candy','Dairy','Frozen','Health & Beauty','Novelty','Vape','Fuel','Lottery','Auto','Other'];
const RANGES = [{ label: '7 days', value: 7 }, { label: '14 days', value: 14 }, { label: '30 days', value: 30 }];
const EMPTY = { item_name: '', department: '', qty: '', unit_cost: '', vendor_name: '', order_date: new Date().toISOString().slice(0, 10), notes: '' };

const SOURCE_BADGE: Record<string, { label: string; icon: any; cls: string }> = {
  invoice: { label: 'Invoice', icon: FileText, cls: 'bg-blue-100 text-blue-700' },
  purchase_order: { label: 'AI Order', icon: Brain, cls: 'bg-violet-100 text-violet-700' },
  manual: { label: 'Manual', icon: PencilLine, cls: 'bg-amber-100 text-amber-700' },
};

export default function OrderHistoryPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/order-history?store_id=${store.id}&days=${days}`);
      const json = await res.json();
      if (!res.ok) { setErr(json.error || 'Could not load order history'); setLoading(false); return; }
      setData(json);
    } catch {
      setErr('Could not load order history — check your connection and try again');
    }
    setLoading(false);
  }, [store, days]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !form.item_name || !form.qty) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/order-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, store_id: store.id }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || 'Could not save order'); setSaving(false); return; }
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch {
      setErr('Could not save order — check your connection and try again');
    }
    setSaving(false);
  };

  if (!mounted) return null;
  const groups: Record<string, any[]> = data?.grouped || {};
  const deptKeys = Object.keys(groups).sort();
  const needsReorder = data?.needsReorder || [];
  const orderedButStillLow = data?.orderedButStillLow || [];

  return (
    <Screen title="Order History" subtitle="What you've ordered recently, by category"
      action={<button onClick={() => setShowForm(v => !v)} className={cn('btn text-sm h-9 px-4', showForm ? 'btn-ghost' : 'btn-accent')}><Plus className="h-4 w-4" />{showForm ? 'Cancel' : 'Log Order'}</button>}>
      <div className="space-y-4">
        {err && <div className="tile p-4 border-l-4 border-l-red-400 text-sm text-red-700">{err}</div>}

        <div className="flex gap-2">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setDays(r.value)}
              className={cn('flex-1 rounded-xl py-2 text-sm font-semibold transition', days === r.value ? 'bg-accent text-white' : 'bg-surface text-muted')}>
              {r.label}
            </button>
          ))}
        </div>

        {showForm && (
          <div className="tile p-5">
            <p className="font-bold text-text mb-4">Log an Order</p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="lbl">Item name *</label>
                <input value={form.item_name} onChange={e => f('item_name', e.target.value)} className="inp" placeholder="e.g. Marlboro Red 20ct" autoFocus required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Category</label>
                  <select value={form.department} onChange={e => f('department', e.target.value)} className="inp">
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Quantity *</label>
                  <input type="number" min="0.01" step="0.01" value={form.qty} onChange={e => f('qty', e.target.value)} className="inp" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Unit cost $</label>
                  <input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" placeholder="0.00" />
                </div>
                <div>
                  <label className="lbl">Order date</label>
                  <input type="date" value={form.order_date} onChange={e => f('order_date', e.target.value)} className="inp" />
                </div>
              </div>
              <div>
                <label className="lbl">Vendor</label>
                <input value={form.vendor_name} onChange={e => f('vendor_name', e.target.value)} className="inp" placeholder="Optional" />
              </div>
              <button type="submit" disabled={saving} className="btn btn-accent btn-full">
                {saving ? 'Saving…' : 'Save Order'}
              </button>
            </form>
          </div>
        )}

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {!loading && needsReorder.length > 0 && (
          <div className="tile p-5 border-l-4 border-l-red-400">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="font-bold text-text">Low stock, not reordered in {days} days</p>
            </div>
            <div className="space-y-1">
              {needsReorder.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{p.name} <span className="text-xs text-muted">({p.department || 'Uncategorized'})</span></span>
                  <span className="num font-semibold text-red-600">{p.quantity} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && orderedButStillLow.length > 0 && (
          <div className="tile p-5 border-l-4 border-l-amber-400">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="font-bold text-text">Ordered but still low — check delivery or count</p>
            </div>
            <div className="space-y-1">
              {orderedButStillLow.map((p: any) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-gray-700">{p.name} <span className="text-xs text-muted">({p.department || 'Uncategorized'})</span></span>
                  <span className="num font-semibold text-amber-600">{p.quantity} left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && needsReorder.length === 0 && orderedButStillLow.length === 0 && (
          <div className="tile p-4 flex items-center gap-2 text-sm text-green-700 border-l-4 border-l-green-400">
            <CheckCircle2 className="h-4 w-4" /> No low-stock items right now
          </div>
        )}

        {!loading && deptKeys.length === 0 && (
          <div className="tile p-10 text-center"><Package className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted">No orders found in the last {days} days — scan an invoice, create an AI order, or log one manually</p></div>
        )}

        {!loading && deptKeys.map(dept => (
          <div key={dept} className="tile overflow-hidden">
            <div className="px-5 py-3 bg-surface font-bold text-text text-sm">{dept} <span className="text-muted font-normal">· {groups[dept].length} item{groups[dept].length === 1 ? '' : 's'}</span></div>
            <div className="divide-y divide-border/50">
              {groups[dept].map((line: any) => {
                const badge = SOURCE_BADGE[line.source];
                const Icon = badge.icon;
                return (
                  <div key={line.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', badge.cls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{line.item}</p>
                      <p className="text-xs text-muted">{fmt.date(line.date)}{line.vendor ? ` · ${line.vendor}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="num font-bold text-text">{fmt.number(line.qty, line.qty % 1 === 0 ? 0 : 1)}</p>
                      {line.unit_cost != null && <p className="text-xs text-muted">{fmt.currency(line.unit_cost)}/ea</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
