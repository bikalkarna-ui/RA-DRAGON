'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import {
  Search, Plus, X, Check, Pencil, Trash2, AlertTriangle,
  Package, Zap, History, TrendingDown, TrendingUp,
  ChevronDown, ChevronRight, ArrowUpCircle, ArrowDownCircle,
  Camera, Upload, Filter
} from 'lucide-react';
import { format } from 'date-fns';

const DEPARTMENTS = ['Tobacco/CIG','Beer & Wine','Snacks','Beverages','Candy','Dairy','Frozen','Health & Beauty','Novelty','Vape','Fuel','Lottery','Auto','Other'];

interface Product {
  id: string; name: string; vendor_company: string | null; department: string | null;
  category: string | null; unit_cost: number; unit_price: number; quantity: number;
  min_quantity: number; max_quantity: number; case_pack: number; reorder_qty: number;
  sku: string | null; barcode: string | null; taxable: boolean; location: string | null;
  last_sold_at: string | null; last_received_at: string | null; notes: string | null;
}

function getStatus(p: Product): 'out' | 'critical' | 'low' | 'ok' | 'over' {
  if (p.quantity === 0) return 'out';
  if (p.quantity <= Math.ceil(p.min_quantity * 0.5)) return 'critical';
  if (p.quantity <= p.min_quantity) return 'low';
  if (p.max_quantity && p.quantity >= p.max_quantity) return 'over';
  return 'ok';
}

const STATUS = {
  out:      { label: 'Out',      color: 'bg-red-500',    chip: 'bg-red-100 text-red-700',       border: 'border-l-4 border-l-red-500'    },
  critical: { label: 'Critical', color: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', border: 'border-l-4 border-l-orange-500' },
  low:      { label: 'Low',      color: 'bg-amber-400',  chip: 'bg-amber-100 text-amber-700',   border: 'border-l-4 border-l-amber-400'  },
  over:     { label: 'Over',     color: 'bg-blue-400',   chip: 'bg-blue-100 text-blue-700',     border: ''                               },
  ok:       { label: 'In Stock', color: 'bg-green-500',  chip: 'bg-green-100 text-green-700',   border: ''                               },
};

const EMPTY = { name:'',vendor_company:'',department:'',category:'',sku:'',barcode:'',unit_cost:'',unit_price:'',quantity:'0',min_quantity:'5',max_quantity:'100',case_pack:'1',reorder_qty:'0',location:'',taxable:true,notes:'' };


// Safe date formatter - never crashes on null/undefined dates
const safeFormat = (dateStr: any, pattern: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, pattern);
  } catch { return '—'; }
};

export default function InventoryPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortBy, setSortBy]     = useState<'status'|'name'|'qty'|'sales'>('status');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [invoiceResult, setInvoiceResult] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [movements, setMovements]   = useState<Record<string, any[]>>({});
  const [adjusting, setAdjusting]   = useState<string | null>(null);
  const [adjQty, setAdjQty]         = useState('');
  const [adjNote, setAdjNote]       = useState('');
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const fetchProducts = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const loadMovements = async (productId: string) => {
    if (movements[productId]) { setExpandedId(expandedId === productId ? null : productId); return; }
    const { data } = await createClient().from('inventory_movements').select('*').eq('product_id', productId).order('created_at', { ascending: false }).limit(20);
    setMovements(prev => ({ ...prev, [productId]: data ?? [] }));
    setExpandedId(productId);
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const ms = p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q) || (p.department ?? '').toLowerCase().includes(q);
    const st = getStatus(p);
    const mf = filter === 'all' || st === filter;
    const md = deptFilter === 'all' || p.department === deptFilter;
    return ms && mf && md;
  }).sort((a, b) => {
    if (sortBy === 'status') return STATUS[getStatus(a)].label.localeCompare(STATUS[getStatus(b)].label);
    if (sortBy === 'qty') return a.quantity - b.quantity;
    return a.name.localeCompare(b.name);
  });

  const counts = {
    out: products.filter(p => getStatus(p) === 'out').length,
    critical: products.filter(p => getStatus(p) === 'critical').length,
    low: products.filter(p => getStatus(p) === 'low').length,
    total: products.length,
  };
  const inventoryValue = products.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0);
  const retailValue    = products.reduce((s, p) => s + Number(p.unit_price) * p.quantity, 0);
  const avgMargin      = products.filter(p => p.unit_price > 0).reduce((s, p) => s + ((p.unit_price - p.unit_cost) / p.unit_price * 100), 0) / Math.max(1, products.filter(p => p.unit_price > 0).length);

  const editProduct = (p: Product) => {
    setEditId(p.id); setShowForm(true);
    setForm({ name: p.name, vendor_company: p.vendor_company ?? '', department: p.department ?? '', category: p.category ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', unit_cost: String(p.unit_cost), unit_price: String(p.unit_price), quantity: String(p.quantity), min_quantity: String(p.min_quantity), max_quantity: String(p.max_quantity), case_pack: String(p.case_pack), reorder_qty: String(p.reorder_qty), location: p.location ?? '', taxable: p.taxable, notes: p.notes ?? '' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    const payload = { store_id: store.id, name: form.name, vendor_company: form.vendor_company || null, department: form.department || null, category: form.category || null, sku: form.sku || null, barcode: form.barcode || null, unit_cost: parseFloat(form.unit_cost) || 0, unit_price: parseFloat(form.unit_price) || 0, quantity: parseInt(form.quantity) || 0, min_quantity: parseInt(form.min_quantity) || 0, max_quantity: parseInt(form.max_quantity) || 100, case_pack: parseInt(form.case_pack) || 1, reorder_qty: parseInt(form.reorder_qty) || 0, location: form.location || null, taxable: form.taxable, notes: form.notes || null };
    const sb = createClient();
    if (editId) {
      const { data: old } = await sb.from('products').select('quantity').eq('id', editId).single();
      await sb.from('products').update(payload).eq('id', editId);
      // Record adjustment if quantity changed
      const oldQty = old?.quantity ?? 0;
      const newQty = payload.quantity;
      if (oldQty !== newQty) {
        await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: editId, type: 'adjustment', quantity: newQty - oldQty, reference_type: 'manual', reference_label: 'Manual edit', notes: 'Quantity updated via edit form' }) });
      }
    } else {
      const { data: np } = await sb.from('products').insert(payload).select('id').single();
      if (np && payload.quantity > 0) {
        await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: np.id, type: 'adjustment', quantity: payload.quantity, reference_type: 'manual', reference_label: 'Initial stock', notes: 'Product created' }) });
      }
    }
    setForm(EMPTY); setShowForm(false); setEditId(null); fetchProducts();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await createClient().from('products').update({ is_active: false }).eq('id', id);
    fetchProducts();
  };

  const quickAdjust = async (productId: string, type: 'add' | 'subtract') => {
    const qty = parseInt(adjQty) || 0;
    if (!qty) return;
    const delta = type === 'add' ? qty : -qty;
    await fetch('/api/inventory-movement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, type: type === 'add' ? 'receive' : 'adjustment', quantity: delta, reference_type: 'manual', reference_label: adjNote || (type === 'add' ? 'Manual receive' : 'Manual adjustment'), notes: adjNote }) });
    setAdjusting(null); setAdjQty(''); setAdjNote('');
    fetchProducts();
    // Refresh movements if expanded
    if (expandedId === productId) { setMovements(prev => { const next = { ...prev }; delete next[productId]; return next; }); loadMovements(productId); }
  };

  const MOVE_ICONS: Record<string, any> = { sale: ArrowDownCircle, receive: ArrowUpCircle, adjustment: Check, waste: Trash2, return: ArrowUpCircle };
  const MOVE_COLORS: Record<string, string> = { sale: 'text-red-500', receive: 'text-green-600', adjustment: 'text-blue-500', waste: 'text-orange-500', return: 'text-purple-500' };

  if (!mounted) return null;

  return (
    <Screen title="Inventory" subtitle={`${counts.total} products · ${fmt.currency(inventoryValue)} cost · ${fmt.percent(avgMargin)} avg margin`}
      action={<button onClick={() => setShowForm(v => !v)} className={cn('btn text-sm h-9 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add'}</button>}>
      <div className="space-y-4">

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Out',      count: counts.out,      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    id: 'out'      },
            { label: 'Critical', count: counts.critical,  color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', id: 'critical' },
            { label: 'Low',      count: counts.low,       color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  id: 'low'      },
            { label: 'Total',    count: counts.total,     color: 'text-text',       bg: 'bg-surface',   border: 'border-border',     id: 'all'      },
          ].map(s => (
            <button key={s.id} onClick={() => setFilter(filter === s.id ? 'all' : s.id)}
              className={cn('tile p-3 text-center border transition-all', filter === s.id ? `${s.bg} ${s.border} border-2` : '')}>
              <p className={cn('num text-2xl font-black', s.color)}>{s.count}</p>
              <p className="text-[10px] text-muted font-semibold mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Invoice scan */}
        <div className="tile p-4">
          <p className="text-sm font-bold text-text mb-1">Scan Vendor Invoice</p>
          <p className="text-xs text-muted mb-3">AI reads invoice → matches products → updates costs and stock automatically</p>
          <MultiScan endpoint="/api/scan-invoice" onResult={(d) => { setInvoiceResult(d); fetchProducts(); }} title="📷 Scan Invoice" hint="Photo of vendor invoice — AI extracts every line item" />
          {invoiceResult && (
            <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-900">✓ {invoiceResult.items?.length ?? 0} items from {invoiceResult.invoice?.vendor_name ?? 'invoice'}</p>
              <p className="text-xs text-amber-700 mt-0.5">Go to <a href="/invoices" className="underline font-bold">Invoices</a> to review and apply</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, barcode…" className="inp pl-10 h-9 text-sm" />
          </div>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="inp w-36 h-9 text-sm">
            <option value="all">All depts</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="inp w-32 h-9 text-sm">
            <option value="status">By status</option>
            <option value="qty">By qty</option>
            <option value="name">By name</option>
          </select>
        </div>

        {/* Add/Edit form */}
        {showForm && (
          <div className="tile p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-text">{editId ? 'Edit Product' : 'New Product'}</p>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY); }}><X className="h-5 w-5 text-muted" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className="lbl">Product name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Vendor</label><select value={form.vendor_company} onChange={e => f('vendor_company', e.target.value)} className="inp"><option value="">—</option>{VENDORS.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label className="lbl">Department</label><select value={form.department} onChange={e => f('department', e.target.value)} className="inp"><option value="">—</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                <div><label className="lbl">SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Barcode (UPC)</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} className="inp" placeholder="Scan or type" /></div>
                <div><label className="lbl">Cost $</label><input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Sell Price $</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} className="inp" /></div>
                {form.unit_cost && form.unit_price && Number(form.unit_price) > 0 && (
                  <div className="sm:col-span-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2 flex justify-between text-sm">
                    <span className="text-green-700">Margin</span>
                    <span className="num font-bold text-green-800">{fmt.percent(((Number(form.unit_price) - Number(form.unit_cost)) / Number(form.unit_price)) * 100)}</span>
                  </div>
                )}
                <div><label className="lbl">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Min (alert)</label><input type="number" min="0" value={form.min_quantity} onChange={e => f('min_quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Max (overstock)</label><input type="number" min="0" value={form.max_quantity} onChange={e => f('max_quantity', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Case Pack</label><input type="number" min="1" value={form.case_pack} onChange={e => f('case_pack', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Reorder Qty</label><input type="number" min="0" value={form.reorder_qty} onChange={e => f('reorder_qty', e.target.value)} className="inp" /></div>
                <div><label className="lbl">Location</label><input value={form.location} onChange={e => f('location', e.target.value)} className="inp" placeholder="Aisle 3, Shelf 2…" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-sub cursor-pointer"><input type="checkbox" checked={form.taxable} onChange={e => f('taxable', e.target.checked)} className="accent-accent" />Taxable</label>
              <div><label className="lbl">Notes</label><input value={form.notes} onChange={e => f('notes', e.target.value)} className="inp" placeholder="Optional" /></div>
              <button type="submit" className="btn btn-accent btn-full"><Check className="h-4 w-4" />{editId ? 'Save changes' : 'Add product'}</button>
            </form>
          </div>
        )}

        {/* Product list */}
        <div className="tile overflow-hidden">
          {loading && <p className="py-10 text-center text-muted">Loading…</p>}
          {!loading && filtered.length === 0 && <div className="py-12 text-center"><Package className="mx-auto h-10 w-10 text-dim mb-3" /><p className="text-muted">No products found</p></div>}

          <div className="divide-y divide-border/50">
            {filtered.map(p => {
              const st = getStatus(p);
              const sc = STATUS[st];
              const margin = p.unit_price > 0 ? ((p.unit_price - p.unit_cost) / p.unit_price * 100) : 0;
              const isExpanded = expandedId === p.id;
              const isAdjusting = adjusting === p.id;

              return (
                <div key={p.id} className={cn('transition-colors', sc.border)}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-bold text-text">{p.name}</p>
                          <span className={cn('chip text-[10px] font-bold', sc.chip)}>{sc.label}</span>
                          {p.department && <span className="chip chip-gray text-[10px]">{p.department}</span>}
                        </div>
                        {/* Meta */}
                        <p className="text-xs text-muted">
                          {p.vendor_company ?? '—'} · Cost {fmt.currency(p.unit_cost)} · Price {fmt.currency(p.unit_price)} · Margin {fmt.percent(margin)}
                          {p.barcode && ` · ${p.barcode}`}
                          {p.location && ` · 📍${p.location}`}
                        </p>
                        {/* AI recommendation */}
                        {(st === 'out' || st === 'critical') && (
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5">
                            <Zap className="h-3 w-3 text-red-500 shrink-0" />
                            <p className="text-[11px] text-red-700 font-medium">
                              {st === 'out' ? `Reorder immediately — order ${p.reorder_qty || p.min_quantity * 2} units from ${p.vendor_company ?? 'vendor'}` : `Only ${p.quantity} left — reorder soon`}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Quantity + controls */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setAdjusting(isAdjusting ? null : p.id); setAdjQty(''); setAdjNote(''); }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-text hover:bg-surface active:scale-95 text-sm font-bold">
                            ±
                          </button>
                          <div className={cn('flex h-10 min-w-14 items-center justify-center rounded-xl px-3',
                            st === 'out' ? 'bg-red-100' : st === 'critical' ? 'bg-orange-100' : st === 'low' ? 'bg-amber-100' : 'bg-green-50')}>
                            <span className={cn('num font-black text-xl',
                              st === 'out' ? 'text-red-700' : st === 'critical' ? 'text-orange-700' : st === 'low' ? 'text-amber-700' : 'text-green-700')}>
                              {p.quantity}
                            </span>
                          </div>
                        </div>

                        {/* Stock bar */}
                        <div className="w-20">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', sc.color)}
                              style={{ width: p.max_quantity ? `${Math.min(100, (p.quantity / p.max_quantity) * 100)}%` : st === 'ok' ? '70%' : '20%' }} />
                          </div>
                          <div className="flex justify-between text-[9px] text-dim mt-0.5">
                            <span>min:{p.min_quantity}</span><span>max:{p.max_quantity}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <button onClick={() => loadMovements(p.id)} className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', isExpanded ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-surface')}>
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => editProduct(p)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => del(p.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick adjust panel */}
                    {isAdjusting && (
                      <div className="mt-3 p-3 rounded-xl bg-surface border border-border flex flex-wrap gap-2 items-end animate-fade-up">
                        <div>
                          <label className="text-[10px] text-muted font-semibold block mb-1">QUANTITY</label>
                          <input type="number" min="1" value={adjQty} onChange={e => setAdjQty(e.target.value)} className="inp h-8 w-20 text-sm num" placeholder="0" autoFocus />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted font-semibold block mb-1">REASON</label>
                          <input value={adjNote} onChange={e => setAdjNote(e.target.value)} className="inp h-8 text-sm w-full" placeholder="e.g. Received delivery, count correction…" />
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => quickAdjust(p.id, 'add')} disabled={!adjQty} className="flex items-center gap-1.5 rounded-xl bg-green-600 text-white px-3 py-2 text-xs font-bold hover:bg-green-700 disabled:opacity-40">
                            <ArrowUpCircle className="h-3.5 w-3.5" />+Add
                          </button>
                          <button onClick={() => quickAdjust(p.id, 'subtract')} disabled={!adjQty} className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-3 py-2 text-xs font-bold hover:bg-red-700 disabled:opacity-40">
                            <ArrowDownCircle className="h-3.5 w-3.5" />−Remove
                          </button>
                          <button onClick={() => setAdjusting(null)} className="rounded-xl bg-gray-100 text-gray-600 px-3 py-2 text-xs font-bold hover:bg-gray-200">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Movement history */}
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-surface/50 px-5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">Inventory History</p>
                      {(movements[p.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted">No movements recorded yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(movements[p.id] ?? []).map(mv => {
                            const Icon = MOVE_ICONS[mv.type] ?? Check;
                            const col  = MOVE_COLORS[mv.type] ?? 'text-gray-500';
                            const isIn = Number(mv.quantity) > 0;
                            return (
                              <div key={mv.id} className="flex items-center gap-2.5 text-xs">
                                <Icon className={cn('h-3.5 w-3.5 shrink-0', col)} />
                                <span className="text-muted shrink-0">{safeFormat(mv.created_at, 'MMM d h:mm a')}</span>
                                <span className={cn('num font-bold shrink-0', isIn ? 'text-green-600' : 'text-red-600')}>
                                  {isIn ? '+' : ''}{mv.quantity}
                                </span>
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
