'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { AIUpload } from '@/components/ui/ai-upload';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Search, Plus, X, Check, Pencil, Trash2, ChevronRight } from 'lucide-react';

interface Product { id: string; name: string; vendor_company: string | null; unit_cost: number; unit_price: number; quantity: number; min_quantity: number; max_quantity: number; sku: string | null; barcode: string | null; taxable: boolean; }
const EMPTY = { name: '', vendor_company: '', sku: '', barcode: '', unit_cost: '', unit_price: '', quantity: '0', min_quantity: '5', max_quantity: '100', taxable: true };

export default function InventoryPage() {
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const fetch = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) ?? []); setLoading(false);
  }, [store]);
  useEffect(() => { fetch(); }, [fetch]);

  const getStatus = (p: Product) => p.quantity === 0 ? 'out' : p.quantity <= p.min_quantity ? 'low' : p.max_quantity && p.quantity >= p.max_quantity ? 'over' : 'ok';

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const ms = p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q);
    const st = getStatus(p);
    const mf = filter === 'all' || st === filter;
    return ms && mf;
  });

  const counts = { out: products.filter(p => getStatus(p) === 'out').length, low: products.filter(p => getStatus(p) === 'low').length };

  const edit = (p: Product) => { setEditId(p.id); setShowForm(true); setForm({ name: p.name, vendor_company: p.vendor_company ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', unit_cost: String(p.unit_cost), unit_price: String(p.unit_price), quantity: String(p.quantity), min_quantity: String(p.min_quantity), max_quantity: String(p.max_quantity), taxable: p.taxable }); };

  const reset = () => { setForm(EMPTY); setShowForm(false); setEditId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    const payload = { store_id: store.id, name: form.name, vendor_company: form.vendor_company || null, sku: form.sku || null, barcode: form.barcode || null, unit_cost: parseFloat(form.unit_cost) || 0, unit_price: parseFloat(form.unit_price) || 0, quantity: parseInt(form.quantity, 10) || 0, min_quantity: parseInt(form.min_quantity, 10) || 0, max_quantity: parseInt(form.max_quantity, 10) || 100, taxable: form.taxable };
    const sb = createClient();
    if (editId) await sb.from('products').update(payload).eq('id', editId);
    else await sb.from('products').insert(payload);
    reset(); fetch();
  };

  const del = async (id: string) => { if (!confirm('Delete?')) return; await createClient().from('products').update({ is_active: false }).eq('id', id); fetch(); };

  const STATUS = { out: { chip: 'chip-red', l: 'Out of stock' }, low: { chip: 'chip-yellow', l: 'Low stock' }, over: { chip: 'chip-gray', l: 'Overstock' }, ok: { chip: 'chip-green', l: 'In stock' } };

  return (
    <Screen title="Inventory" subtitle={`${products.length} products · ${fmt.currency(products.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0))} value`}
      action={<button onClick={() => setShowForm(true)} className="btn btn-accent h-9 text-sm px-4">{showForm ? 'Cancel' : '+ Add'}</button>}>
      <div className="space-y-5">

        {/* AI invoice upload */}
        <div className="tile p-5">
          <p className="text-sm font-semibold text-text mb-1">Upload Vendor Invoice</p>
          <p className="text-xs text-muted mb-4">AI reads invoice, extracts products, updates inventory</p>
          <AIUpload label="Upload Invoice" description="PDF or photo — AI does the rest" endpoint="/api/scan-invoice"
            onResult={(d) => { if (d.items?.find((i: any) => i.is_new_product)) { setForm(p => ({ ...p, name: d.items[0].raw_description, unit_cost: String(d.items[0].unit_cost), unit_price: String(d.items[0].suggested_price ?? '') })); setShowForm(true); } }} compact />
        </div>

        {/* Alerts */}
        {(counts.out > 0 || counts.low > 0) && (
          <div className="tile p-4 border border-amber-500/20 bg-amber-500/5">
            <p className="text-amber-400 text-sm font-semibold">{counts.out > 0 ? `${counts.out} out of stock · ` : ''}{counts.low > 0 ? `${counts.low} low stock` : ''}</p>
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ id: 'all', l: 'All' }, { id: 'out', l: `Out (${counts.out})` }, { id: 'low', l: `Low (${counts.low})` }].map(ft => (
            <button key={ft.id} onClick={() => setFilter(ft.id)} className={cn('flex-none rounded-full px-4 py-2 text-sm font-medium transition-colors', filter === ft.id ? 'bg-accent text-white' : 'bg-card text-sub hover:text-text border border-border')}>{ft.l}</button>
          ))}
        </div>

        {/* Search */}
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, barcode…" className="inp pl-11" /></div>

        {/* Form */}
        {showForm && (
          <div className="tile p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-text">{editId ? 'Edit product' : 'New product'}</h3><button onClick={reset}><X className="h-5 w-5 text-muted" /></button></div>
            <form onSubmit={submit} className="space-y-3">
              <div><label className="lbl">Product name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" /></div>
              <div><label className="lbl">Vendor</label><select value={form.vendor_company} onChange={e => f('vendor_company', e.target.value)} className="inp">{[{ label: '— unassigned', value: '' }, ...VENDORS.map(v => ({ label: v, value: v }))].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl">SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Barcode</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Cost $</label><input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Price $</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Min stock</label><input type="number" min="0" value={form.min_quantity} onChange={e => f('min_quantity', e.target.value)} className="inp" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-sub cursor-pointer"><input type="checkbox" checked={form.taxable} onChange={e => f('taxable', e.target.checked)} className="accent-accent" />Taxable item</label>
              <button type="submit" className="btn btn-accent btn-full"><Check className="h-4 w-4" />{editId ? 'Save changes' : 'Add product'}</button>
            </form>
          </div>
        )}

        {/* Product list */}
        <div className="tile overflow-hidden">
          <div className="divide-y divide-border/60">
            {loading && <p className="py-10 text-center text-muted">Loading…</p>}
            {!loading && filtered.length === 0 && <p className="py-10 text-center text-muted">No products found.</p>}
            {filtered.map(p => {
              const st = getStatus(p); const s = STATUS[st];
              return (
                <div key={p.id} className="list-row">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text truncate">{p.name}</p>
                      <span className={s.chip}>{s.l}</span>
                    </div>
                    <p className="text-xs text-muted">{p.vendor_company ?? '—'} · Cost: {fmt.currency(p.unit_cost)} · Price: {fmt.currency(p.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="num font-bold text-text">{p.quantity}</p>
                      <p className="text-xs text-dim">units</p>
                    </div>
                    <button onClick={() => edit(p)} className="p-2 text-muted hover:text-text"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(p.id)} className="p-2 text-muted hover:text-accent"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Screen>
  );
}
