'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDOR_COMPANIES } from '@/lib/utils';
import { Plus, Search, Pencil, Trash2, X, Check, AlertTriangle, Package, TrendingUp, TrendingDown } from 'lucide-react';

interface Product {
  id: string; sku: string | null; barcode: string | null; name: string;
  vendor_company: string | null; unit_cost: number; unit_price: number;
  quantity: number; min_quantity: number; max_quantity: number; taxable: boolean;
  categories?: { name: string } | null;
}

const EMPTY = { sku:'', barcode:'', name:'', vendor_company:'', unit_cost:'', unit_price:'', quantity:'0', min_quantity:'5', max_quantity:'100', taxable:true };

export default function InventoryPage() {
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const fetchProducts = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('name');
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const f = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const getStatus = (p: Product) => {
    if (p.quantity === 0) return 'out';
    if (p.quantity <= p.min_quantity) return 'low';
    if (p.max_quantity && p.quantity >= p.max_quantity) return 'over';
    return 'ok';
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q) || (p.barcode ?? '').includes(q);
    const matchVendor = filterVendor === 'all' || p.vendor_company === filterVendor;
    const status = getStatus(p);
    const matchStatus = filterStatus === 'all' || status === filterStatus;
    return matchSearch && matchVendor && matchStatus;
  });

  const counts = { out: products.filter(p => getStatus(p) === 'out').length, low: products.filter(p => getStatus(p) === 'low').length, over: products.filter(p => getStatus(p) === 'over').length };
  const inventoryValue = products.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0);

  const startEdit = (p: Product) => {
    setEditingId(p.id); setShowForm(true);
    setForm({ sku:p.sku??'', barcode:p.barcode??'', name:p.name, vendor_company:p.vendor_company??'', unit_cost:String(p.unit_cost), unit_price:String(p.unit_price), quantity:String(p.quantity), min_quantity:String(p.min_quantity), max_quantity:String(p.max_quantity), taxable:p.taxable });
  };

  const reset = () => { setForm(EMPTY); setShowForm(false); setEditingId(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    const payload = { store_id:store.id, sku:form.sku||null, barcode:form.barcode||null, name:form.name, vendor_company:form.vendor_company||null, unit_cost:parseFloat(form.unit_cost)||0, unit_price:parseFloat(form.unit_price)||0, quantity:parseInt(form.quantity,10)||0, min_quantity:parseInt(form.min_quantity,10)||0, max_quantity:parseInt(form.max_quantity,10)||100, taxable:form.taxable };
    const sb = createClient();
    if (editingId) await sb.from('products').update(payload).eq('id', editingId);
    else await sb.from('products').insert(payload);
    reset(); fetchProducts();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await createClient().from('products').update({ is_active: false }).eq('id', id);
    fetchProducts();
  };

  const STATUS_STYLE: Record<string, { badge: string; row: string }> = {
    out: { badge: 'bg-fire-900/50 text-fire-400', row: 'border-l-2 border-fire-700' },
    low: { badge: 'bg-gold-900/30 text-gold-400', row: 'border-l-2 border-gold-700' },
    over: { badge: 'bg-obsidian-700 text-obsidian-300', row: '' },
    ok: { badge: 'bg-obsidian-800 text-obsidian-400', row: '' },
  };

  return (
    <AppShell title="Inventory" storeName={store?.name}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Total Products', value:String(products.length), sub:'active', icon:Package },
            { label:'Inventory Value', value:fmt.currency(inventoryValue), sub:'at cost', icon:Package },
            { label:'Low / Out of Stock', value:`${counts.low} / ${counts.out}`, sub:'need ordering', icon:AlertTriangle },
            { label:'Overstocked', value:String(counts.over), sub:'above max', icon:TrendingUp },
          ].map(k => { const Icon = k.icon; return (
            <div key={k.label} className="d-card p-4">
              <p className="text-xs text-obsidian-500">{k.label}</p>
              <p className="mono text-xl font-bold text-white mt-1">{k.value}</p>
              <p className="text-xs text-obsidian-600">{k.sub}</p>
            </div>
          ); })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-obsidian-600" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, SKU, barcode…" className="d-input pl-9 w-52 h-9" />
            </div>
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)} className="d-select w-40 h-9">
              <option value="all">All vendors</option>
              {VENDOR_COMPANIES.map(v => <option key={v.id} value={v.name}>{v.emoji} {v.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="d-select w-40 h-9">
              <option value="all">All status</option>
              <option value="out">Out ({counts.out})</option>
              <option value="low">Low ({counts.low})</option>
              <option value="over">Overstocked ({counts.over})</option>
              <option value="ok">OK</option>
            </select>
          </div>
          <button onClick={() => showForm ? reset() : setShowForm(true)} className={showForm ? 'btn-ghost py-2 h-9' : 'btn-fire h-9'}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add product'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="d-card p-5">
            <h3 className="font-semibold text-white mb-4">{editingId ? 'Edit product' : 'New product'}</h3>
            <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2"><label className="d-label">Product name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Vendor company</label>
                <select value={form.vendor_company} onChange={e => f('vendor_company', e.target.value)} className="d-select">
                  <option value="">— unassigned —</option>
                  {VENDOR_COMPANIES.filter(v => v.id !== 'custom').map(v => <option key={v.id} value={v.name}>{v.emoji} {v.name}</option>)}
                </select>
              </div>
              <div><label className="d-label">SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Barcode (UPC)</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} className="d-input" placeholder="Scan or type" /></div>
              <div><label className="d-label">Cost price $</label><input type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => f('unit_cost', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Selling price $</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => f('unit_price', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Quantity</label><input type="number" min="0" value={form.quantity} onChange={e => f('quantity', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Min stock (alert)</label><input type="number" min="0" value={form.min_quantity} onChange={e => f('min_quantity', e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Max stock (overstock)</label><input type="number" min="0" value={form.max_quantity} onChange={e => f('max_quantity', e.target.value)} className="d-input" /></div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-obsidian-300 cursor-pointer"><input type="checkbox" checked={form.taxable} onChange={e => f('taxable', e.target.checked)} className="accent-fire-600" />Taxable</label>
              </div>
              <div className="col-span-2 sm:col-span-4"><button type="submit" className="btn-fire"><Check className="h-4 w-4" />{editingId ? 'Save changes' : 'Add product'}</button></div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="d-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-900/50 border-b border-dragon-border">
                <tr>
                  {['Product', 'Vendor', 'SKU', 'Cost', 'Price', 'Margin', 'Stock', 'Min', 'Max', 'Status', ''].map(h => (
                    <th key={h} className={cn('px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-obsidian-500', ['Cost','Price','Margin','Stock','Min','Max'].includes(h) ? 'text-right' : '')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dragon-border">
                {loading && <tr><td colSpan={11} className="py-10 text-center text-obsidian-500">Loading…</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-obsidian-500">No products match your filters.</td></tr>}
                {filtered.map(p => {
                  const status = getStatus(p);
                  const ss = STATUS_STYLE[status];
                  const vc = VENDOR_COMPANIES.find(v => v.name === p.vendor_company);
                  const margin = p.unit_price > 0 ? ((p.unit_price - p.unit_cost) / p.unit_price * 100) : 0;
                  return (
                    <tr key={p.id} className={cn('hover:bg-obsidian-900/30 transition-colors', ss.row)}>
                      <td className="px-3 py-2.5 font-medium text-white">{p.name}</td>
                      <td className="px-3 py-2.5 text-obsidian-400 text-xs">{vc ? `${vc.emoji} ${vc.name}` : '—'}</td>
                      <td className="mono px-3 py-2.5 text-obsidian-500 text-xs">{p.sku ?? '—'}</td>
                      <td className="mono px-3 py-2.5 text-right text-obsidian-400">{fmt.currency(p.unit_cost)}</td>
                      <td className="mono px-3 py-2.5 text-right text-obsidian-300">{fmt.currency(p.unit_price)}</td>
                      <td className="mono px-3 py-2.5 text-right text-gold-500 text-xs">{fmt.percent(margin)}</td>
                      <td className="mono px-3 py-2.5 text-right font-bold text-white">{p.quantity}</td>
                      <td className="mono px-3 py-2.5 text-right text-obsidian-600 text-xs">{p.min_quantity}</td>
                      <td className="mono px-3 py-2.5 text-right text-obsidian-600 text-xs">{p.max_quantity}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn('d-badge text-[10px]', ss.badge)}>
                          {status === 'out' ? 'OUT' : status === 'low' ? 'LOW' : status === 'over' ? 'OVER' : 'OK'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => startEdit(p)} className="p-1.5 rounded text-obsidian-600 hover:text-white hover:bg-obsidian-800 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => del(p.id)} className="p-1.5 rounded text-obsidian-600 hover:text-fire-500 hover:bg-fire-950/50 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
