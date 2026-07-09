'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Brain, Loader2, Check, X, ChevronDown, ChevronUp, Zap, Download, RefreshCw, Package, Plus, Minus } from 'lucide-react';

export default function OrderingPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [vendor, setVendor] = useState('');
  const [vendorList, setVendorList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const loadOrders = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('purchase_orders').select('*, purchase_order_items(*)').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20);
    setOrders(data ?? []);
  }, [store]);

  const loadProducts = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('*').eq('store_id', store.id).eq('is_active', true).lte('quantity', 10).order('quantity');
    setProducts(data ?? []);
  }, [store]);

  // Pull real vendor names from actual inventory instead of a hardcoded list —
  // this is what was causing "no products assigned" for real vendors.
  const loadVendors = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('products').select('vendor_company').eq('store_id', store.id).eq('is_active', true).not('vendor_company', 'is', null);
    const unique = Array.from(new Set((data ?? []).map(p => p.vendor_company).filter(Boolean))).sort();
    setVendorList(unique as string[]);
  }, [store]);

  useEffect(() => { if (mounted && store) { loadOrders(); loadProducts(); loadVendors(); } }, [mounted, store, loadOrders, loadProducts, loadVendors]);

  const generateOrder = async () => {
    if (!store || !vendor) return;
    setGenerating(true);
    setCurrentOrder(null);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: vendor, vendor_company: vendor }),
      });
      const data = await res.json();
      if (data.success && data.orderId) {
        const { data: full } = await createClient().from('purchase_orders').select('*, purchase_order_items(*)').eq('id', data.orderId).single();
        setCurrentOrder(full);
        loadOrders();
      } else alert(data.error || 'Failed to generate order');
    } catch { alert('Network error'); }
    setGenerating(false);
  };

  const updateQty = (itemId: string, delta: number) => {
    if (!currentOrder) return;
    setCurrentOrder((o: any) => ({
      ...o,
      purchase_order_items: o.purchase_order_items.map((i: any) =>
        i.id === itemId ? { ...i, order_qty: Math.max(0, (i.order_qty || 0) + delta), line_total: (i.unit_cost || 0) * Math.max(0, (i.order_qty || 0) + delta) } : i
      ),
    }));
  };

  const exportPO = (order: any) => {
    if (!order) return;
    const rows = [['Product', 'SKU', 'Current Stock', 'Order Qty', 'Case Pack', 'Unit Cost', 'Line Total', 'AI Reason']];
    (order.purchase_order_items || []).forEach((i: any) => {
      rows.push([i.product_name, i.sku ?? '—', String(i.current_stock), String(i.order_qty), String(i.case_pack), fmt.currency(i.unit_cost), fmt.currency(i.line_total), i.ai_reason ?? '']);
    });
    rows.push(['', '', '', '', 'TOTAL', '', fmt.currency(order.total || 0), '']);
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PO-${order.vendor_name}-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (!mounted) return null;

  const n = (v: any) => Number(v || 0);
  const todayOrders   = orders.filter(o => o.created_at?.startsWith(new Date().toISOString().split('T')[0]));
  const ydayOrders    = orders.filter(o => { const y = new Date(Date.now()-86400000).toISOString().split('T')[0]; return o.created_at?.startsWith(y); });
  const weekOrders    = orders.filter(o => o.created_at >= new Date(Date.now()-7*86400000).toISOString());

  return (
    <Screen title="AI Ordering" subtitle="Smart purchase orders powered by AI">
      <div className="space-y-5">

        {/* Low stock summary */}
        {products.length > 0 && (
          <div className="tile p-4 border-l-4 border-l-accent">
            <div className="flex items-center gap-2 mb-2"><Package className="h-4 w-4 text-accent" /><p className="text-sm font-bold text-text">{products.length} items need ordering</p></div>
            <p className="text-xs text-muted">{products.slice(0, 5).map(p => p.name).join(' · ')}{products.length > 5 ? ` +${products.length - 5} more` : ''}</p>
          </div>
        )}

        {/* Generate */}
        <div className="tile p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50"><Brain className="h-5 w-5 text-violet-600" /></div>
            <div><p className="font-bold text-text">Generate AI Purchase Order</p><p className="text-xs text-muted">AI analyzes 30/60/90-day velocity to calculate exact quantities</p></div>
          </div>
          <select value={vendor} onChange={e => setVendor(e.target.value)} className="inp mb-3">
            <option value="">{vendorList.length ? 'Select vendor…' : 'No vendors found on your products yet'}</option>
            {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          {vendorList.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
              No products have a vendor assigned yet. Set a vendor company for products in Inventory, or scan a vendor invoice — it fills this in automatically.
            </p>
          )}
          <button onClick={generateOrder} disabled={!vendor || generating} className="btn btn-accent btn-full gap-2 py-4">
            {generating ? <><Loader2 className="h-5 w-5 animate-spin" />Analyzing sales data…</> : <><Brain className="h-5 w-5" />Generate Order for {vendor || 'vendor'}</>}
          </button>
        </div>

        {/* Current generated order */}
        {currentOrder && (
          <div className="tile overflow-hidden border-2 border-violet-300">
            <div className="bg-violet-50 px-5 py-4 border-b border-violet-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1"><Zap className="h-4 w-4 text-violet-600" /><p className="font-bold text-text">AI Order — {currentOrder.vendor_name}</p></div>
                  <p className="text-xs text-violet-700">{(currentOrder.purchase_order_items || []).length} items · Total: {fmt.currency(n(currentOrder.total))}</p>
                </div>
                <button onClick={() => exportPO(currentOrder)} className="btn btn-ghost text-sm h-9 px-4 gap-1.5"><Download className="h-4 w-4" />Export</button>
              </div>
              {currentOrder.ai_notes && <div className="mt-2 text-xs text-violet-700 bg-violet-100 rounded-lg px-3 py-2">{currentOrder.ai_notes}</div>}
            </div>
            <div className="divide-y divide-border/50">
              {(currentOrder.purchase_order_items || []).map((item: any) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-text text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted">Stock: {item.current_stock} · Case: {item.case_pack} · {fmt.currency(item.unit_cost)}/unit</p>
                      {item.ai_reason && <p className="text-xs text-violet-700 mt-1 bg-violet-50 rounded px-2 py-1">{item.ai_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button onClick={() => updateQty(item.id, -item.case_pack)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-accent"><Minus className="h-4 w-4" /></button>
                      <div className="text-center min-w-12">
                        <p className="num font-black text-xl text-text">{item.order_qty}</p>
                        <p className="text-[9px] text-muted">units</p>
                      </div>
                      <button onClick={() => updateQty(item.id, item.case_pack)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-green-600"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">30d: {item.velocity_30d?.toFixed(0)} · 60d: {item.velocity_60d?.toFixed(0)} · 90d: {item.velocity_90d?.toFixed(0)}</span>
                    <span className="num font-bold text-text">{fmt.currency(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 bg-surface border-t border-border flex justify-between items-center">
              <p className="font-black text-text">Total</p>
              <p className="num font-black text-2xl text-text">{fmt.currency((currentOrder.purchase_order_items || []).reduce((s: number, i: any) => s + n(i.unit_cost) * n(i.order_qty), 0))}</p>
            </div>
          </div>
        )}

        {/* Order history */}
        {orders.length > 0 && (
          <>
            <p className="section-title">Order History</p>
            {[
              { label: 'Today', items: todayOrders },
              { label: 'Yesterday', items: ydayOrders },
              { label: 'This Week', items: weekOrders.filter(o => !todayOrders.includes(o) && !ydayOrders.includes(o)) },
              { label: 'Archive', items: orders.filter(o => !weekOrders.includes(o)) },
            ].filter(g => g.items.length > 0).map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted mb-2">{group.label}</p>
                <div className="space-y-2">
                  {group.items.slice(0, 5).map(order => (
                    <div key={order.id} className="tile overflow-hidden">
                      <button onClick={() => setExpandedPO(expandedPO === order.id ? null : order.id)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface transition-colors">
                        <div className="text-left">
                          <p className="font-semibold text-text text-sm">{order.vendor_name}</p>
                          <p className="text-xs text-muted">{(order.purchase_order_items || []).length} items · {(() => { try { return new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return '—'; } })()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="num font-bold text-text">{fmt.currency(n(order.total))}</p>
                          <span className={cn('chip text-[10px]', order.status === 'sent' ? 'chip-blue' : order.status === 'received' ? 'chip-green' : 'chip-gray')}>{order.status}</span>
                          {expandedPO === order.id ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                        </div>
                      </button>
                      {expandedPO === order.id && (
                        <div className="border-t border-border bg-surface/50">
                          <div className="divide-y divide-border/50">
                            {(order.purchase_order_items || []).map((item: any) => (
                              <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                                <div><p className="text-sm text-text">{item.product_name}</p><p className="text-xs text-muted">Stock: {item.current_stock} → Order: {item.order_qty}</p></div>
                                <p className="num font-bold text-text text-sm">{fmt.currency(n(item.line_total))}</p>
                              </div>
                            ))}
                          </div>
                          <div className="px-5 py-3 flex justify-between border-t border-border">
                            <button onClick={() => exportPO(order)} className="btn btn-ghost text-sm h-8 px-3 gap-1.5"><Download className="h-3.5 w-3.5" />Export CSV</button>
                            <p className="num font-black text-text">{fmt.currency(n(order.total))}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Screen>
  );
}
