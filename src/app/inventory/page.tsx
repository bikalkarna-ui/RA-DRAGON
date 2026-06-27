'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Search, Plus, X, Check, Pencil, Trash2, AlertTriangle, Package, Zap } from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';

const DEPARTMENTS = ['Tobacco/CIG', 'Beer & Wine', 'Snacks', 'Beverages', 'Candy', 'Dairy', 'Frozen', 'Health & Beauty', 'Novelty', 'Vape', 'Fuel', 'Lottery', 'Other'];

interface Product { id: string; name: string; vendor_company: string | null; department: string | null; unit_cost: number; unit_price: number; quantity: number; min_quantity: number; max_quantity: number; sku: string | null; barcode: string | null; taxable: boolean; last_sold_at: string | null; }
const EMPTY = { name: '', vendor_company: '', department: '', sku: '', barcode: '', unit_cost: '', unit_price: '', quantity: '0', min_quantity: '5', max_quantity: '100', taxable: true };

// Smart stock status
function getStatus(p: Product): 'out' | 'critical' | 'low' | 'ok' | 'over' {
  if (p.quantity === 0) return 'out';
  if (p.quantity <= Math.ceil(p.min_quantity * 0.5)) return 'critical';
  if (p.quantity <= p.min_quantity) return 'low';
  if (p.max_quantity && p.quantity >= p.max_quantity) return 'over';
  return 'ok';
}

const STATUS_CONFIG = {
  out:      { label: 'Out of Stock', chip: 'bg-red-100 text-red-700',       border: 'border-l-4 border-l-red-500',    icon: '🔴', priority: 0 },
  critical: { label: 'Critical',     chip: 'bg-orange-100 text-orange-700',  border: 'border-l-4 border-l-orange-500', icon: '🟠', priority: 1 },
  low:      { label: 'Low Stock',    chip: 'bg-amber-100 text-amber-700',    border: 'border-l-4 border-l-amber-400',  icon: '🟡', priority: 2 },
  over:     { label: 'Overstocked',  chip: 'bg-blue-100 text-blue-700',      border: '',                               icon: '🔵', priority: 4 },
  ok:       { label: 'In Stock',     chip: 'bg-green-100 text-green-700',    border: '',                               icon: '🟢', priority: 5 },
};

export default function InventoryPage() {
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'status' | 'name' | 'quantity'>('status');
  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const fetch = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) ?? []); setLoading(false);
  }, [store]);
  useEffect(() => { fetch(); }, [fetch]);

  const filtered = products
    .filter(p => {
      const q = search.toLowerCase();
      const ms = p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q) || (p.department ?? '').toLowerCase().includes(q);
      const st = getStatus(p);
      const mf = filter === 'all' || st === filter;
      return ms && mf;
    })
    .sort((a, b) => {
      if (sortBy === 'status') return STATUS_CONFIG[getStatus(a)].priority - STATUS_CONFIG[getStatus(b)].priority;
      if (sortBy === 'quantity') return a.quantity - b.quantity;
      return a.name.localeCompare(b.name);
    });

  const counts = {
    out: products.filter(p => getStatus(p) === 'out').length,
    critical: products.filter(p => getStatus(p) === 'critical').length,
    low: products.filter(p => getStatus(p) === 'low').length,
    over: products.filter(p => getStatus(p) === 'over').length,
  };
  const needsAttention = counts.out + counts.critical + counts.low;
  const inventoryValue = products.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0);

  const edit = (p: Product) => {
    setEditId(p.id); setShowForm(true);
    setForm({ name: p.name, vendor_company: p.vendor_company ?? '', department: p.department ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', unit_cost: String(p.unit_cost), unit_price: String(p.unit_price), quantity: String(p.quantity), min_quantity: String(p.min_quantity), max_quantity: String(p.max_quantity), taxable: p.taxable });
  };

  const reset = () => { setForm(EMPTY); setShowForm(false); setEditId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    const payload = { store_id: store.id, name: form.name, vendor_company: form.vendor_company || null, department: form.department || null, sku: form.sku || null, barcode: form.barcode || null, unit_cost: parseFloat(form.unit_cost) || 0, unit_price: parseFloat(form.unit_price) || 0, quantity: parseInt(form.quantity, 10) || 0, min_quantity: parseInt(form.min_quantity, 10) || 0, max_quantity: parseInt(form.max_quantity, 10) || 100, taxable: form.taxable };
    const sb = createClient();
    if (editId) await sb.from('products').update(payload).eq('id', editId);
    else await sb.from('products').insert(payload);
    reset(); fetch();
  };

  const del = async (id: string) => { if (!confirm('Delete this product?')) return; await createClient().from('products').update({ is_active: false }).eq('id', id); fetch(); };

  const adjustQty = async (id: string, current: number, delta: number) => {
    const newQty = Math.max(0, current + delta);
    await createClient().from('products').update({ quantity: newQty }).eq('id', id);
    setProducts(ps => ps.map(p => p.id === id ? { ...p, quantity: newQty } : p));
  };

  return (
    <Screen title="Inventory" subtitle={`${products.length} products · ${fmt.currency(inventoryValue)} value`}
      action={<button onClick={() => setShowForm(v => !v)} className={showForm ? 'btn btn-ghost h-9 text-sm px-3' : 'btn btn-accent h-9 text-sm px-3'}>{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add'}</button>}>
      <div className="space-y-5">

        {/* Smart alert banner */}
        {needsAttention > 0 && (
          <div className="tile p-4 border-l-4 border-l-accent bg-red-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-bold text-accent text-sm">{needsAttention} product{needsAttention > 1 ? 's' : ''} need attention</p>
                  <p className="text-xs text-red-600">{counts.out > 0 ? `${counts.out} out · ` : ''}{counts.critical > 0 ? `${counts.critical} critical · ` : ''}{counts.low > 0 ? `${counts.low} low` : ''}</p>
                </div>
              </div>
              <button onClick={() => setFilter('out')} className="text-xs text-accent font-semibold underline">View all</button>
            </div>
          </div>
        )}

        {/* Invoice scan/upload */}
        <div className="tile p-4">
          <p className="text-sm font-bold text-text mb-1">Upload or Scan Invoice</p>
          <p className="text-xs text-muted mb-3">AI reads vendor invoice, matches products, updates costs and stock</p>
          <MultiScan
            endpoint="/api/scan-invoice"
            onResult={(d) => { setInvoiceResult(d); fetch(); }}
            title="📸 Scan Invoice"
            hint="Photo of vendor invoice — AI extracts every product and updates costs"
          />
          {invoiceResult && (
            <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">✓ AI found {invoiceResult.items?.length ?? 0} products from {invoiceResult.invoice?.vendor_name ?? 'invoice'}</p>
              <p className="text-sm text-amber-700 mt-1">Products are NOT added yet — you need to review and confirm first.</p>
              <a href="/invoices" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-bold hover:bg-red-700 transition-colors">
                Go to Invoices → Review &amp; Apply
              </a>
            </div>
          )}
        </div>

        {/* Status summary tiles */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'out', label: 'Out', count: counts.out, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
            { id: 'critical', label: 'Critical', count: counts.critical, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
            { id: 'low', label: 'Low', count: counts.low, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
            { id: 'over', label: 'Over', count: counts.over, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          ].map(s => (
            <button key={s.id} onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
              className={cn('tile p-3 text-center border transition-all', filter === s.id ? `${s.bg} ${s.border} border-2` : '')}>
              <p className={cn('num text-2xl font-black', s.color)}>{s.count}</p>
              <p className="text-xs text-muted mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Filters + search */}
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, SKU, barcode, department…" className="inp pl-10 h-9 text-sm" /></div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="inp w-32 h-9 text-sm">
            <option value="status">By status</option>
            <option value="quantity">By qty</option>
            <option value="name">By name</option>
          </select>
        </div>

        {/* Add/edit form */}
        {showForm && (
          <div className="tile p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-text">{editId ? 'Edit product' : 'New product'}</h3><button onClick={reset}><X className="h-5 w-5 text-muted" /></button></div>
            <form onSubmit={submit} className="space-y-3">
              <div><label className="lbl">Product name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl">Vendor</label><select value={form.vendor_company} onChange={e => f('vendor_company', e.target.value)} className="inp">{[{ label: '— unassigned', value: '' }, ...VENDORS.map(v => ({ label: v, value: v }))].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label className="lbl">Department</label><select value={form.department} onChange={e => f('department', e.target.value)} className="inp">{[{ label: '— none', value: '' }, ...DEPARTMENTS.map(d => ({ label: d, value: d }))].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label className="lbl">SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Barcode (UPC)</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} className="inp" placeholder="Scan or type" /></div>
                <div><label className="lbl">Cost $</label><input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Sell Price $</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Min (alert at)</label><input type="number" min="0" value={form.min_quantity} onChange={e => f('min_quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Max (overstock at)</label><input type="number" min="0" value={form.max_quantity} onChange={e => f('max_quantity', e.target.value)} className="inp" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-sub cursor-pointer"><input type="checkbox" checked={form.taxable} onChange={e => f('taxable', e.target.checked)} className="accent-accent" />Taxable item</label>
              <button type="submit" className="btn btn-accent btn-full"><Check className="h-4 w-4" />{editId ? 'Save changes' : 'Add product'}</button>
            </form>
          </div>
        )}

        {/* Product list */}
        <div className="tile overflow-hidden">
          <div className="divide-y divide-border/50">
            {loading && <p className="py-10 text-center text-muted">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center py-12">
                <Package className="h-10 w-10 text-dim mb-3" />
                <p className="text-muted">No products found.</p>
              </div>
            )}
            {filtered.map(p => {
              const st = getStatus(p);
              const sc = STATUS_CONFIG[st];
              const margin = p.unit_price > 0 ? ((p.unit_price - p.unit_cost) / p.unit_price * 100) : 0;
              const isAlert = st === 'out' || st === 'critical' || st === 'low';

              return (
                <div key={p.id} className={cn('px-5 py-4 hover:bg-surface transition-colors', sc.border)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-text">{p.name}</p>
                        <span className={cn('chip text-[10px] font-bold', sc.chip)}>{sc.icon} {sc.label}</span>
                        {p.department && <span className="chip chip-gray text-[10px]">{p.department}</span>}
                      </div>

                      {/* Vendor + price info */}
                      <p className="text-xs text-muted mt-0.5">{p.vendor_company ?? '—'} · Cost {fmt.currency(p.unit_cost)} · Price {fmt.currency(p.unit_price)} · Margin {margin.toFixed(0)}%</p>
                      {p.sku && <p className="text-[10px] text-dim font-mono mt-0.5">SKU: {p.sku}</p>}

                      {/* AI recommendation */}
                      {isAlert && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
                          <Zap className="h-3 w-3 text-amber-600 shrink-0" />
                          <p className="text-[11px] text-amber-700 font-medium">
                            {st === 'out' ? `Order immediately from ${p.vendor_company ?? 'vendor'}` :
                             st === 'critical' ? `Only ${p.quantity} left — order ${Math.max(p.min_quantity * 3, 12)} units` :
                             `Running low — reorder when convenient`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Quantity adjuster */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => adjustQty(p.id, p.quantity, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-sub hover:bg-surface active:scale-95 text-sm font-bold">−</button>
                        <div className={cn('flex h-9 min-w-12 items-center justify-center rounded-xl px-2', st === 'out' ? 'bg-red-100' : st === 'critical' ? 'bg-orange-100' : st === 'low' ? 'bg-amber-100' : 'bg-green-50')}>
                          <span className={cn('num font-black text-lg', st === 'out' ? 'text-red-700' : st === 'critical' ? 'text-orange-700' : st === 'low' ? 'text-amber-700' : 'text-green-700')}>{p.quantity}</span>
                        </div>
                        <button onClick={() => adjustQty(p.id, p.quantity, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-sub hover:bg-surface active:scale-95 text-sm font-bold">+</button>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => edit(p)} className="p-1.5 text-muted hover:text-text rounded-lg hover:bg-surface"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => del(p.id)} className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all',
                        st === 'out' ? 'bg-red-400 w-0' :
                        st === 'critical' ? 'bg-orange-400' :
                        st === 'low' ? 'bg-amber-400' :
                        st === 'over' ? 'bg-blue-400 w-full' : 'bg-green-400'
                      )} style={{ width: p.max_quantity ? `${Math.min(100, (p.quantity / p.max_quantity) * 100)}%` : st === 'ok' ? '70%' : '20%' }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-dim mt-0.5">
                      <span>Min: {p.min_quantity}</span>
                      <span>Max: {p.max_quantity}</span>
                    </div>
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
