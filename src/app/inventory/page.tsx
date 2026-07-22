'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { EmptyState } from '@/components/ui/empty-state';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Search, Plus, X, Check, Pencil, Trash2, Package, Zap, History, ArrowUpCircle, ArrowDownCircle, Filter, TrendingUp, TrendingDown, AlertTriangle, Brain, Bell, Download } from 'lucide-react';

const DEPARTMENTS = ['Tobacco/CIG','Beer & Wine','Snacks','Beverages','Candy','Dairy','Frozen','Health & Beauty','Novelty','Vape','Fuel','Lottery','Auto','Other'];
const EMPTY = { name:'',vendor_company:'',department:'',category:'',sku:'',barcode:'',unit_cost:'',unit_price:'',quantity:'0',min_quantity:'5',max_quantity:'100',case_pack:'1',reorder_qty:'0',location:'',taxable:true,notes:'' };

interface Product {
  id: string; name: string; vendor_company: string|null; department: string|null;
  category: string|null; unit_cost: number; unit_price: number; quantity: number;
  min_quantity: number; max_quantity: number; case_pack: number; reorder_qty: number;
  sku: string|null; barcode: string|null; taxable: boolean; location: string|null;
  last_sold_at: string|null; last_received_at: string|null; notes: string|null;
}

function getStatus(p: Product): 'out'|'critical'|'low'|'ok'|'over' {
  if (p.quantity === 0) return 'out';
  if (p.quantity <= Math.ceil(p.min_quantity * 0.5)) return 'critical';
  if (p.quantity <= p.min_quantity) return 'low';
  if (p.max_quantity && p.quantity >= p.max_quantity) return 'over';
  return 'ok';
}

const STATUS = {
  out:      { label:'Out',      chip:'chip-red',    bar:'bg-red-500',    border:'border-l-4 border-l-red-500' },
  critical: { label:'Critical', chip:'chip-red',    bar:'bg-orange-500', border:'border-l-4 border-l-orange-500' },
  low:      { label:'Low',      chip:'chip-yellow', bar:'bg-amber-400',  border:'border-l-4 border-l-amber-400' },
  over:     { label:'Over',     chip:'chip-blue',   bar:'bg-blue-400',   border:'' },
  ok:       { label:'OK',       chip:'chip-green',  bar:'bg-green-500',  border:'' },
};

type ViewFilter = 'all'|'out'|'critical'|'low'|'over';
type SortMode = 'status'|'name'|'qty'|'margin'|'value';

export default function InventoryPage() {
  const { store } = useStore();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [dept, setDept] = useState('all');
  const [sort, setSort] = useState<SortMode>('status');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState(EMPTY);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [movements, setMovements] = useState<Record<string,any[]>>({});
  const [adjustId, setAdjustId] = useState<string|null>(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setMounted(true); }, []);

  const fetch_ = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) fetch_(); }, [mounted, store, fetch_]);

  const loadMv = async (pid: string) => {
    if (movements[pid]) { setExpandedId(expandedId === pid ? null : pid); return; }
    const { data } = await createClient().from('inventory_movements').select('*').eq('product_id', pid).order('created_at', { ascending: false }).limit(20);
    setMovements(p => ({ ...p, [pid]: data ?? [] }));
    setExpandedId(pid);
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const ms = p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q) || (p.department ?? '').toLowerCase().includes(q) || (p.vendor_company ?? '').toLowerCase().includes(q);
    const st = getStatus(p);
    return ms && (filter === 'all' || st === filter) && (dept === 'all' || p.department === dept);
  }).sort((a, b) => {
    const stOrder = { out: 0, critical: 1, low: 2, ok: 3, over: 4 };
    if (sort === 'status') return stOrder[getStatus(a)] - stOrder[getStatus(b)];
    if (sort === 'qty') return a.quantity - b.quantity;
    if (sort === 'margin') return ((b.unit_price - b.unit_cost) / Math.max(b.unit_price, 0.01)) - ((a.unit_price - a.unit_cost) / Math.max(a.unit_price, 0.01));
    if (sort === 'value') return (b.unit_cost * b.quantity) - (a.unit_cost * a.quantity);
    return a.name.localeCompare(b.name);
  });

  const counts = { out: 0, critical: 0, low: 0, total: products.length };
  products.forEach(p => { const st = getStatus(p); if (st === 'out') counts.out++; if (st === 'critical') counts.critical++; if (st === 'low') counts.low++; });
  const invValue   = products.reduce((s, p) => s + p.unit_cost * p.quantity, 0);
  const retailVal  = products.reduce((s, p) => s + p.unit_price * p.quantity, 0);
  const avgMargin  = products.filter(p => p.unit_price > 0).reduce((s, p) => s + ((p.unit_price - p.unit_cost) / p.unit_price * 100), 0) / Math.max(1, products.filter(p => p.unit_price > 0).length);

  const topMargin  = [...products].filter(p => p.unit_price > p.unit_cost).sort((a, b) => ((b.unit_price-b.unit_cost)/b.unit_price) - ((a.unit_price-a.unit_cost)/a.unit_price)).slice(0, 5);
  const deadStock  = products.filter(p => p.quantity > 10 && !p.last_sold_at);

  const editProduct = (p: Product) => {
    setEditId(p.id); setShowForm(true);
    setForm({ name: p.name, vendor_company: p.vendor_company ?? '', department: p.department ?? '', category: p.category ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', unit_cost: String(p.unit_cost), unit_price: String(p.unit_price), quantity: String(p.quantity), min_quantity: String(p.min_quantity), max_quantity: String(p.max_quantity), case_pack: String(p.case_pack), reorder_qty: String(p.reorder_qty), location: p.location ?? '', taxable: p.taxable, notes: p.notes ?? '' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    const payload = { store_id: store.id, name: form.name, vendor_company: form.vendor_company || null, department: form.department || null, category: form.category || null, sku: form.sku || null, barcode: form.barcode || null, unit_cost: parseFloat(form.unit_cost)||0, unit_price: parseFloat(form.unit_price)||0, quantity: parseInt(form.quantity)||0, min_quantity: parseInt(form.min_quantity)||0, max_quantity: parseInt(form.max_quantity)||100, case_pack: parseInt(form.case_pack)||1, reorder_qty: parseInt(form.reorder_qty)||0, location: form.location||null, taxable: form.taxable, notes: form.notes||null };
    const sb = createClient();
    if (editId) {
      const { data: old } = await sb.from('products').select('quantity').eq('id', editId).single();
      await sb.from('products').update(payload).eq('id', editId);
      if (old && old.quantity !== payload.quantity) {
        await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: editId, type: 'adjustment', quantity: payload.quantity - old.quantity, reference_type: 'manual', reference_label: 'Manual edit', notes: 'Updated via edit form' }) });
      }
    } else {
      const { data: np } = await sb.from('products').insert(payload).select('id').single();
      if (np && payload.quantity > 0) {
        await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: np.id, type: 'adjustment', quantity: payload.quantity, reference_type: 'manual', reference_label: 'Initial stock' }) });
      }
    }
    setForm(EMPTY); setShowForm(false); setEditId(null); fetch_();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await createClient().from('products').update({ is_active: false }).eq('id', id);
    fetch_();
  };

  const quickAdjust = async (pid: string, type: 'add'|'sub') => {
    const qty = parseInt(adjQty) || 0; if (!qty) return;
    const delta = type === 'add' ? qty : -qty;
    await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: pid, type: type === 'add' ? 'receive' : 'adjustment', quantity: delta, reference_type: 'manual', reference_label: adjNote || (type === 'add' ? 'Manual receive' : 'Manual adjustment'), notes: adjNote }) });
    setAdjustId(null); setAdjQty(''); setAdjNote(''); fetch_();
    if (expandedId === pid) { setMovements(p => { const n = { ...p }; delete n[pid]; return n; }); setTimeout(() => loadMv(pid), 300); }
  };

  if (!mounted) return null;

  return (
    <Screen title="Inventory"
      subtitle={`${counts.total} products · ${fmt.currency(invValue)} cost · ${fmt.percent(avgMargin)} avg margin`}
      action={
        <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(EMPTY); }}
          className={cn('btn text-sm h-9 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add'}
        </button>
      }>
      <div className="space-y-4">

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label:'Out',      val: counts.out,      f:'out',      clr:'text-red-600',    bg: counts.out > 0 ? 'border-red-300 bg-red-50' : '' },
            { label:'Critical', val: counts.critical,  f:'critical',  clr:'text-orange-600', bg: counts.critical > 0 ? 'border-orange-300 bg-orange-50' : '' },
            { label:'Low',      val: counts.low,       f:'low',       clr:'text-amber-600',  bg: counts.low > 0 ? 'border-amber-300 bg-amber-50' : '' },
            { label:'Total',    val: counts.total,     f:'all',       clr:'text-text',       bg:'' },
          ].map(s => (
            <button key={s.f} onClick={() => setFilter(filter === s.f ? 'all' : s.f as ViewFilter)}
              className={cn('tile p-3 text-center border-2 transition-all', filter === s.f ? s.bg || 'border-accent' : 'border-transparent')}>
              <p className={cn('num text-2xl font-black', s.clr)}>{s.val}</p>
              <p className="text-[10px] text-muted font-semibold mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Value strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted font-medium">Cost Value</p>
            <p className="num font-black text-text text-lg mt-0.5">{fmt.currency(invValue)}</p>
          </div>
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted font-medium">Retail Value</p>
            <p className="num font-black text-green-700 text-lg mt-0.5">{fmt.currency(retailVal)}</p>
          </div>
        </div>

        {/* Related tools */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/ordering" className="tile p-3 text-center hover:bg-surface transition-colors active:scale-95">
            <Brain className="h-4 w-4 mx-auto text-violet-600 mb-1" />
            <p className="text-[11px] font-bold text-text">AI Ordering</p>
          </Link>
          <Link href="/alerts" className="tile p-3 text-center hover:bg-surface transition-colors active:scale-95">
            <Bell className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <p className="text-[11px] font-bold text-text">Alerts &amp; Pricing</p>
          </Link>
          <Link href="/migration" className="tile p-3 text-center hover:bg-surface transition-colors active:scale-95">
            <Download className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <p className="text-[11px] font-bold text-text">Import CSV</p>
          </Link>
        </div>

        {/* Invoice scan */}
        <div className="tile p-4">
          <p className="text-sm font-bold text-text mb-1">Scan Vendor Invoice</p>
          <p className="text-xs text-muted mb-3">AI reads every product, price, and quantity — updates costs automatically</p>
          <MultiScan endpoint="/api/scan-invoice" onResult={(d) => { setInvoiceResult(d); fetch_(); }} title="Scan Invoice" hint="Photo of vendor invoice" />
          {invoiceResult && (
            <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-900">✓ {invoiceResult.items?.length ?? 0} items from {invoiceResult.invoice?.vendor_name ?? 'invoice'}</p>
              <a href="/invoices" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent text-white px-4 py-2 text-sm font-bold">Go to Invoices → Review &amp; Apply</a>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, SKU, barcode, vendor…" className="inp pl-10 h-9 text-sm" />
          </div>
          <select value={dept} onChange={e => setDept(e.target.value)} className="inp w-32 h-9 text-sm">
            <option value="all">All depts</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as SortMode)} className="inp w-28 h-9 text-sm">
            <option value="status">By status</option>
            <option value="qty">By qty</option>
            <option value="margin">By margin</option>
            <option value="value">By value</option>
            <option value="name">By name</option>
          </select>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="tile p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-text">{editId ? 'Edit Product' : 'New Product'}</p>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}><X className="h-5 w-5 text-muted" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className="lbl">Product name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" autoFocus /></div>
                <div><label className="lbl">Vendor</label><select value={form.vendor_company} onChange={e => f('vendor_company', e.target.value)} className="inp"><option value="">—</option>{VENDORS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label className="lbl">Department</label><select value={form.department} onChange={e => f('department', e.target.value)} className="inp"><option value="">—</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="lbl">SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Barcode</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Cost $</label><input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Sell Price $</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} className="inp" /></div>
                {form.unit_cost && form.unit_price && Number(form.unit_price) > 0 && (
                  <div className="sm:col-span-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2 flex justify-between">
                    <span className="text-sm text-green-700">Margin</span>
                    <span className="num font-bold text-green-800">{fmt.percent(((Number(form.unit_price)-Number(form.unit_cost))/Number(form.unit_price))*100)}</span>
                  </div>
                )}
                <div><label className="lbl">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Min (alert)</label><input type="number" min="0" value={form.min_quantity} onChange={e => f('min_quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Max (overstock)</label><input type="number" min="0" value={form.max_quantity} onChange={e => f('max_quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Case Pack</label><input type="number" min="1" value={form.case_pack} onChange={e => f('case_pack', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Location</label><input value={form.location} onChange={e => f('location', e.target.value)} className="inp" placeholder="Aisle 3, Shelf 2…" /></div>
                <div><label className="lbl">Reorder Qty</label><input type="number" min="0" value={form.reorder_qty} onChange={e => f('reorder_qty', e.target.value)} className="inp" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-sub cursor-pointer"><input type="checkbox" checked={form.taxable} onChange={e => f('taxable', e.target.checked)} className="accent-accent" />Taxable</label>
              <div><label className="lbl">Notes</label><input value={form.notes} onChange={e => f('notes', e.target.value)} className="inp" /></div>
              <button type="submit" className="btn btn-accent btn-full"><Check className="h-4 w-4" />{editId ? 'Save changes' : 'Add product'}</button>
            </form>
          </div>
        )}

        {/* Dead stock insight */}
        {deadStock.length > 0 && (
          <div className="tile p-4 border-l-4 border-l-amber-400">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><p className="text-sm font-bold text-amber-800">Dead Stock ({deadStock.length} items)</p></div>
            <p className="text-xs text-amber-700">These products have never sold: {deadStock.slice(0,3).map(p => p.name).join(', ')}{deadStock.length > 3 ? ` +${deadStock.length-3} more` : ''}</p>
          </div>
        )}

        {/* Top margin items */}
        {topMargin.length > 0 && (
          <div className="tile p-4 border-l-4 border-l-green-400">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-green-600" /><p className="text-sm font-bold text-green-800">Highest Margin Products</p></div>
            <div className="space-y-1">
              {topMargin.map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="num font-bold text-green-700">{fmt.percent(((p.unit_price-p.unit_cost)/p.unit_price)*100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product list */}
        <div className="tile overflow-hidden">
          {loading && <p className="py-10 text-center text-muted">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={Package}
              title={search || filter !== 'all' ? 'No matching products' : 'No products yet'}
              description={search || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first product, scan a vendor invoice, or import a CSV to get started.'}
              color="blue"
              action={!search && filter === 'all' ? { label: 'Add a product', onClick: () => setShowForm(true) } : undefined}
            />
          )}
          <div className="divide-y divide-border/50">
            {filtered.map(p => {
              const st = getStatus(p);
              const sc = STATUS[st];
              const margin = p.unit_price > 0 ? ((p.unit_price - p.unit_cost) / p.unit_price * 100) : 0;
              const isExpanded = expandedId === p.id;
              const isAdj = adjustId === p.id;
              return (
                <div key={p.id} className={cn('transition-colors', sc.border)}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-text">{p.name}</p>
                          <span className={cn('chip text-[10px]', sc.chip)}>{sc.label}</span>
                          {p.department && <span className="chip chip-gray text-[10px]">{p.department}</span>}
                        </div>
                        <p className="text-xs text-muted">
                          {p.vendor_company ?? '—'} · Cost {fmt.currency(p.unit_cost)} · Price {fmt.currency(p.unit_price)} · Margin {fmt.percent(margin)}
                          {p.barcode && ` · ${p.barcode}`}
                          {p.location && ` · 📍${p.location}`}
                        </p>
                        {(st === 'out' || st === 'critical') && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                            <Zap className="h-3 w-3 text-red-500 shrink-0" />
                            <p className="text-[11px] text-red-700 font-medium">
                              {st === 'out' ? `Order immediately from ${p.vendor_company ?? 'vendor'} — reorder qty: ${p.reorder_qty || p.min_quantity*2}` : `Only ${p.quantity} left — reorder soon`}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setAdjustId(isAdj ? null : p.id); setAdjQty(''); setAdjNote(''); }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-text text-sm font-bold">±</button>
                          <div className={cn('flex h-10 min-w-14 items-center justify-center rounded-xl px-3',
                            st==='out'?'bg-red-100':st==='critical'?'bg-orange-100':st==='low'?'bg-amber-100':'bg-green-50')}>
                            <span className={cn('num font-black text-xl',
                              st==='out'?'text-red-700':st==='critical'?'text-orange-700':st==='low'?'text-amber-700':'text-green-700')}>{p.quantity}</span>
                          </div>
                        </div>
                        <div className="w-20">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', sc.bar)} style={{ width: p.max_quantity ? `${Math.min(100,(p.quantity/p.max_quantity)*100)}%` : st==='ok'?'70%':'20%' }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-dim mt-0.5">
                            <span>{p.min_quantity}</span><span>{p.max_quantity}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => loadMv(p.id)} className={cn('flex h-7 w-7 items-center justify-center rounded-lg', isExpanded?'bg-accent text-white':'text-muted hover:text-text hover:bg-surface')}>
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => editProduct(p)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => del(p.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>

                    {isAdj && (
                      <div className="mt-3 p-3 rounded-xl bg-surface border border-border flex flex-wrap gap-2 items-end">
                        <div><label className="text-[10px] text-muted font-semibold block mb-1">QTY</label><input type="number" min="1" value={adjQty} onChange={e => setAdjQty(e.target.value)} className="inp h-8 w-20 text-sm num" autoFocus /></div>
                        <div className="flex-1"><label className="text-[10px] text-muted font-semibold block mb-1">REASON</label><input value={adjNote} onChange={e => setAdjNote(e.target.value)} className="inp h-8 text-sm w-full" placeholder="Received, count correction…" /></div>
                        <div className="flex gap-1.5">
                          <button onClick={() => quickAdjust(p.id,'add')} disabled={!adjQty} className="flex items-center gap-1 rounded-xl bg-green-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-40"><ArrowUpCircle className="h-3.5 w-3.5"/>+Add</button>
                          <button onClick={() => quickAdjust(p.id,'sub')} disabled={!adjQty} className="flex items-center gap-1 rounded-xl bg-red-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-40"><ArrowDownCircle className="h-3.5 w-3.5"/>−Remove</button>
                          <button onClick={() => setAdjustId(null)} className="rounded-xl bg-gray-100 text-gray-600 px-3 py-2 text-xs font-bold">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/60 bg-surface/50 px-5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">Movement History</p>
                      {(movements[p.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted">No movements yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(movements[p.id] ?? []).map(mv => {
                            const isIn = Number(mv.quantity) > 0;
                            return (
                              <div key={mv.id} className="flex items-center gap-2.5 text-xs">
                                {isIn ? <ArrowUpCircle className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <ArrowDownCircle className="h-3.5 w-3.5 text-accent shrink-0" />}
                                <span className="text-muted shrink-0">{(() => { try { return new Date(mv.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); } catch { return '—'; } })()}</span>
                                <span className={cn('num font-bold shrink-0', isIn?'text-green-600':'text-accent')}>{isIn?'+':''}{mv.quantity}</span>
                                <span className="text-muted capitalize">{mv.type}</span>
                                {mv.reference_label && <span className="text-dim">· {mv.reference_label}</span>}
                                <span className="text-dim ml-auto">{mv.quantity_before} → {mv.quantity_after}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Screen>
  );
}
