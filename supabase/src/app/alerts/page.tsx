'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, Package, Zap, RefreshCw, Check } from 'lucide-react';

type Tab = 'stock' | 'prices';


// Safe date formatter - never crashes on null/undefined dates

export default function AlertsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { store } = useStore();
  const [tab, setTab]       = useState<Tab>('stock');
  const [notifs, setNotifs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const sb = createClient();
    const [{ data: prods }, { data: invs }] = await Promise.all([
      sb.from('products').select('id,name,quantity,min_quantity,max_quantity,unit_cost,unit_price,vendor_company,department,sku').eq('store_id', store.id).eq('is_active', true).order('quantity'),
      sb.from('invoices').select('*,invoice_items(id,raw_description,unit_cost,old_cost,suggested_price,old_price,price_changed,product_id,quantity)').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW').order('created_at', { ascending: false }),
    ]);

    // Auto-generate notifications
    const alerts: any[] = [];
    for (const p of prods ?? []) {
      if (p.quantity === 0) alerts.push({ type: 'out_of_stock', title: `${p.name} is OUT OF STOCK`, message: `Order from ${p.vendor_company ?? 'vendor'} immediately`, product: p, priority: 1 });
      else if (p.quantity <= Math.ceil(p.min_quantity * 0.5)) alerts.push({ type: 'critical', title: `${p.name} — Critical`, message: `Only ${p.quantity} left (min: ${p.min_quantity})`, product: p, priority: 2 });
      else if (p.quantity <= p.min_quantity) alerts.push({ type: 'low_stock', title: `${p.name} — Low Stock`, message: `${p.quantity} remaining (min: ${p.min_quantity})`, product: p, priority: 3 });
    }
    alerts.sort((a, b) => a.priority - b.priority);

    setNotifs(alerts);
    setInvoices(invs ?? []);
    setProducts(prods ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  // Price change items across all invoices needing review
  const priceChanges = invoices.flatMap(inv =>
    (inv.invoice_items ?? []).filter((i: any) => i.price_changed).map((i: any) => ({
      ...i, vendor_name: inv.vendor_name, vendor_company: inv.vendor_company,
      invoice_id: inv.id, invoice_date: inv.created_at,
    }))
  );

  const margin = (cost: number, price: number) => price > 0 ? ((price - cost) / price * 100) : 0;

  if (!mounted) return null;

  return (
    <Screen title="Alerts" subtitle="Stock alerts &amp; price change notifications">
      <div className="space-y-5">

        {/* Tab bar */}
        <div className="flex gap-2">
          {[{ id: 'stock', label: `🔔 Stock Alerts (${notifs.length})` }, { id: 'prices', label: `💰 Price Changes (${priceChanges.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── STOCK ALERTS ── */}
        {tab === 'stock' && (
          <div className="space-y-3">
            {loading && <div className="tile p-10 text-center"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}
            {!loading && notifs.length === 0 && (
              <div className="tile p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-bold text-text text-lg mb-1">All products stocked</p>
                <p className="text-muted text-sm">No stock alerts right now</p>
              </div>
            )}

            {/* Group by type */}
            {['out_of_stock', 'critical', 'low_stock'].map(type => {
              const group = notifs.filter(n => n.type === type);
              if (!group.length) return null;
              const config = {
                out_of_stock: { label: 'Out of Stock', color: 'border-red-400 bg-red-50', titleColor: 'text-red-800', badge: 'bg-red-100 text-red-700' },
                critical:     { label: 'Critical',     color: 'border-orange-400 bg-orange-50', titleColor: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
                low_stock:    { label: 'Low Stock',    color: 'border-amber-300 bg-amber-50', titleColor: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
              }[type]!;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('chip font-bold', config.badge)}>{config.label}</span>
                    <span className="text-xs text-muted">{group.length} products</span>
                  </div>
                  <div className="space-y-2">
                    {group.map((n, i) => {
                      const p = n.product;
                      const needUnits = Math.max((p.reorder_qty || p.min_quantity * 2) - p.quantity, 0);
                      const estCost = needUnits * Number(p.unit_cost);
                      return (
                        <div key={i} className={cn('tile p-4 border-l-4', type === 'out_of_stock' ? 'border-l-red-500' : type === 'critical' ? 'border-l-orange-500' : 'border-l-amber-400')}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className={cn('font-bold text-sm', config.titleColor)}>{n.title}</p>
                              <p className="text-xs text-muted mt-0.5">{n.message}</p>
                              {p.vendor_company && <p className="text-xs text-muted">Vendor: {p.vendor_company} · {p.department ?? '—'}</p>}
                            </div>
                            <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shrink-0 text-white font-black text-lg',
                              type === 'out_of_stock' ? 'bg-red-500' : type === 'critical' ? 'bg-orange-500' : 'bg-amber-400')}>
                              {p.quantity}
                            </div>
                          </div>

                          {/* AI Recommendation */}
                          <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 mb-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Zap className="h-3.5 w-3.5 text-violet-600" />
                              <p className="text-xs font-bold text-violet-700">AI Recommendation</p>
                            </div>
                            <p className="text-xs text-violet-800">
                              {type === 'out_of_stock'
                                ? `Order ${needUnits || p.min_quantity * 2} units immediately from ${p.vendor_company ?? 'your vendor'}. Est. cost: ${fmt.currency(estCost || p.unit_cost * p.min_quantity * 2)}`
                                : `Reorder ${needUnits} units to reach min level. ${p.vendor_company ? `Contact ${p.vendor_company}` : 'Contact your vendor'}`}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <a href="/ordering" className="flex-1 btn btn-accent text-xs py-2">Generate AI Order →</a>
                            <a href="/inventory" className="flex-1 btn btn-ghost text-xs py-2">View Inventory</a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PRICE CHANGES ── */}
        {tab === 'prices' && (
          <div className="space-y-3">
            {loading && <div className="tile p-10 text-center"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}
            {!loading && priceChanges.length === 0 && (
              <div className="tile p-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-bold text-text mb-1">No price changes pending</p>
                <p className="text-muted text-sm">Scan a vendor invoice to detect price changes automatically</p>
              </div>
            )}

            {priceChanges.map((item, i) => {
              const oldM = item.old_cost && item.old_price ? margin(item.old_cost, item.old_price) : null;
              const newM = item.unit_cost && item.suggested_price ? margin(item.unit_cost, item.suggested_price) : null;
              const costUp = Number(item.unit_cost) > Number(item.old_cost);
              return (
                <div key={i} className="tile p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-text">{item.raw_description}</p>
                      <p className="text-xs text-muted">{item.vendor_name} · {(item.invoice_date ? (() => { try { return (() => { try { const __d = new Date(item.invoice_date); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—')}</p>
                    </div>
                    <div className={cn('chip font-bold', costUp ? 'chip-red' : 'chip-green')}>
                      {costUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {costUp ? 'Cost Up' : 'Cost Down'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                      <p className="text-[10px] text-muted font-semibold uppercase mb-1">Old Cost</p>
                      <p className="num font-black text-text">{fmt.currency(item.old_cost ?? 0)}</p>
                      {oldM !== null && <p className="text-xs text-muted mt-0.5">Margin: {fmt.percent(oldM)}</p>}
                    </div>
                    <div className={cn('rounded-xl border p-3', costUp ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
                      <p className="text-[10px] text-muted font-semibold uppercase mb-1">New Cost</p>
                      <p className={cn('num font-black', costUp ? 'text-accent' : 'text-green-700')}>{fmt.currency(item.unit_cost ?? 0)}</p>
                      {newM !== null && <p className="text-xs text-muted mt-0.5">New margin: {fmt.percent(newM)}</p>}
                    </div>
                  </div>

                  {/* Suggested retail */}
                  {item.suggested_price && (
                    <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 mb-3">
                      <div className="flex items-center gap-1.5 mb-1"><Zap className="h-3.5 w-3.5 text-violet-600" /><p className="text-xs font-bold text-violet-700">AI Recommendation</p></div>
                      <p className="text-xs text-violet-800">
                        {costUp
                          ? `Cost increased by ${fmt.currency(Number(item.unit_cost) - Number(item.old_cost))}. Suggested new retail: ${fmt.currency(item.suggested_price)} to maintain margin`
                          : `Cost decreased — consider keeping current retail price to improve your margin`}
                      </p>
                    </div>
                  )}

                  <a href="/invoices" className="btn btn-accent btn-full text-sm py-2.5">Review Invoice &amp; Apply →</a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Screen>
  );
}
