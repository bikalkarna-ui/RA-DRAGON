'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Brain, Loader2, Check, X, ChevronDown, ChevronUp, Package, Zap, TrendingDown } from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';

export default function OrderingPage() {
  const { store } = useStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStockProds, setLowStockProds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [salesDataLoaded, setSalesDataLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: v }, { data: o }, { data: prods }] = await Promise.all([
      sb.from('vendors').select('*').eq('store_id', store.id).order('company_name'),
      sb.from('vendor_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20),
      sb.from('products').select('id,name,quantity,min_quantity,vendor_company').eq('store_id', store.id).eq('is_active', true),
    ]);
    setVendors(v ?? []);
    setOrders(o ?? []);
    // Find products at or below min stock
    setLowStockProds((prods ?? []).filter((p: any) => p.quantity <= p.min_quantity));
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const gen = async (vendor: any) => {
    setGenerating(vendor.id); setError(null);
    try {
      const res = await fetch('/api/ai-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendorId: vendor.id, vendorName: vendor.company_name }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      await fetchData();
      // Auto-expand the new order
      if (d.orderId) { loadItems(d.orderId); }
    } catch (err: any) { setError(err.message); }
    finally { setGenerating(null); }
  };

  const loadItems = async (id: string) => {
    if (orderItems[id]) { setExpanded(expanded === id ? null : id); return; }
    const { data } = await createClient().from('vendor_order_items').select('*').eq('order_id', id).order('product_name');
    setOrderItems(p => ({ ...p, [id]: data ?? [] })); setExpanded(id);
  };

  const approve = async (id: string) => { await createClient().from('vendor_orders').update({ status: 'approved' }).eq('id', id); fetchData(); };
  const del = async (id: string) => { if (!confirm('Delete this order?')) return; await createClient().from('vendor_orders').delete().eq('id', id); fetchData(); };

  const STATUS: Record<string, string> = { draft: 'chip-gray', approved: 'chip-yellow', sent: 'chip-blue', received: 'chip-green' };

  // Group low stock by vendor
  const lowByVendor = lowStockProds.reduce((acc: Record<string, any[]>, p) => {
    const v = p.vendor_company ?? 'Unassigned';
    acc[v] = acc[v] ? [...acc[v], p] : [p];
    return acc;
  }, {});

  return (
    <Screen title="AI Smart Ordering" subtitle="Scan or upload a report — AI generates your order">
      <div className="space-y-6">

        {/* ── SCAN / UPLOAD REPORT ── */}
        <div className="tile p-5">
          <MultiScan
            endpoint="/api/scan-report"
            onResult={() => setSalesDataLoaded(true)}
            title="📸 Scan Your Sales Report"
            hint="Photo or PDF of your Modisoft report — AI uses sales data to improve order quantities"
          />
          {salesDataLoaded && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-200 px-3 py-2">
              <Zap className="h-4 w-4 text-violet-600 shrink-0" />
              <p className="text-xs text-violet-700 font-medium">Sales data loaded — AI will now suggest smarter quantities below</p>
            </div>
          )}
        </div>

        {/* ── LOW STOCK ALERT ── */}
        {lowStockProds.length > 0 && (
          <div className="tile overflow-hidden border border-amber-200">
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-800">{lowStockProds.length} products need reordering</p>
            </div>
            <div className="divide-y divide-border/60">
              {Object.entries(lowByVendor).map(([vendor, prods]) => (
                <div key={vendor} className="px-4 py-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{vendor}</p>
                  <div className="flex flex-wrap gap-2">
                    {(prods as any[]).map((p: any) => (
                      <span key={p.id} className={cn('chip text-xs font-semibold', p.quantity === 0 ? 'chip-red' : 'chip-yellow')}>
                        {p.quantity === 0 ? '🔴' : '🟡'} {p.name} ({p.quantity}/{p.min_quantity})
                      </span>
                    ))}
                  </div>
                  {vendors.find(v => v.company_name === vendor) && (
                    <button
                      onClick={() => gen(vendors.find(v => v.company_name === vendor)!)}
                      disabled={!!generating}
                      className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline disabled:opacity-50">
                      <Brain className="h-3.5 w-3.5" />Generate {vendor} order now →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="tile p-4 border border-accent/30 bg-red-50"><p className="text-accent text-sm font-medium">{error}</p></div>}

        {/* ── VENDOR GRID ── */}
        <div>
          <p className="section-title">Generate Order by Vendor</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {vendors.map(vendor => {
              const isGen = generating === vendor.id;
              const vendorLow = lowByVendor[vendor.company_name] ?? [];
              return (
                <button key={vendor.id} onClick={() => gen(vendor)} disabled={!!generating}
                  className={cn('tile p-5 text-left active:scale-95 transition-transform disabled:opacity-60',
                    vendorLow.length > 0 && 'border-amber-300 border-2')}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 mb-3">
                    <Brain className={cn('h-5 w-5 text-violet-600', isGen && 'animate-pulse')} />
                  </div>
                  <p className="font-bold text-text text-sm">{vendor.company_name}</p>
                  {vendor.rep_name && <p className="text-xs text-muted mt-0.5 mb-2">{vendor.rep_name}</p>}
                  {vendorLow.length > 0 && (
                    <p className="text-[11px] text-amber-700 font-semibold">⚠ {vendorLow.length} items low</p>
                  )}
                  {isGen ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
                      <span className="text-xs text-violet-600 font-medium">AI analyzing…</span>
                    </div>
                  ) : (
                    <p className="text-xs text-violet-600 font-semibold mt-2">Tap to generate order →</p>
                  )}
                </button>
              );
            })}
            {!loading && vendors.length === 0 && (
              <div className="col-span-2 tile p-8 text-center">
                <Package className="mx-auto h-8 w-8 text-dim mb-2" />
                <p className="text-muted text-sm">No vendors set up yet. Go to Settings to add vendors.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ORDER HISTORY ── */}
        {orders.length > 0 && (
          <div>
            <p className="section-title">Recent Orders</p>
            <div className="tile overflow-hidden divide-y divide-border/60">
              {orders.map(order => {
                const isExp = expanded === order.id;
                const items = orderItems[order.id] ?? [];
                return (
                  <div key={order.id}>
                    <button onClick={() => loadItems(order.id)} className="list-row w-full text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                          <Brain className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-text">{order.vendor_name}</p>
                            <span className={STATUS[order.status] ?? 'chip-gray'}>{order.status}</span>
                          </div>
                          <p className="text-xs text-muted">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num text-sm font-black text-text">{fmt.currency(order.total_estimated)}</span>
                        {isExp ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                      </div>
                    </button>

                    {isExp && (
                      <div className="border-t border-border/60 bg-surface">
                        {order.ai_reasoning && (
                          <div className="px-4 py-3 border-b border-border/60 flex items-start gap-2">
                            <Zap className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-600"><span className="font-semibold text-violet-700">AI reasoning: </span>{order.ai_reasoning}</p>
                          </div>
                        )}

                        {/* Items table */}
                        <div className="divide-y divide-border/40">
                          {items.map((item: any) => (
                            <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-text truncate">{item.product_name}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className={cn('text-xs font-medium', item.current_stock === 0 ? 'text-red-600' : item.current_stock <= 5 ? 'text-amber-600' : 'text-muted')}>
                                    Stock: {item.current_stock}
                                  </span>
                                  <span className="text-xs text-muted">→ Order: <span className="font-bold text-text">{item.suggested_qty}</span></span>
                                  {item.reason && <span className="text-xs text-muted hidden sm:inline">· {item.reason}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="num text-sm font-bold text-text">{fmt.currency(item.line_total)}</p>
                                <p className="num text-xs text-muted">{fmt.currency(item.unit_cost)} each</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Total row */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-white">
                          <p className="text-sm font-black text-text">Total</p>
                          <p className="num font-black text-accent text-lg">{fmt.currency(order.total_estimated)}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 px-4 pb-4">
                          {order.status === 'draft' && (
                            <button onClick={() => approve(order.id)} className="btn btn-accent text-xs h-9 px-4">
                              <Check className="h-3.5 w-3.5" />Approve Order
                            </button>
                          )}
                          {order.status === 'approved' && (
                            <button onClick={() => createClient().from('vendor_orders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', order.id).then(fetchData)} className="btn btn-accent text-xs h-9 px-4">
                              Mark as Sent
                            </button>
                          )}
                          <button onClick={() => del(order.id)} className="btn btn-ghost text-xs h-9 px-3">
                            <X className="h-3.5 w-3.5" />Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
