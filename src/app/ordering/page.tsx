'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Brain, Package, Loader2, Check, X, ChevronDown, ChevronUp, Zap, TrendingDown, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderingPage() {
  const { store } = useStore();
  const [products, setProducts]       = useState<any[]>([]);
  const [orders, setOrders]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [generating, setGenerating]   = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [orderItems, setOrderItems]   = useState<Record<string, any[]>>({});
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: prods }, { data: pos }] = await Promise.all([
      sb.from('products').select('id,name,vendor_company,department,quantity,min_quantity,max_quantity,unit_cost,unit_price,case_pack,reorder_qty,sku,barcode').eq('store_id', store.id).eq('is_active', true).order('name'),
      sb.from('purchase_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setProducts(prods ?? []);
    setOrders(pos ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  // Group low-stock products by vendor
  const lowStock = products.filter(p => p.quantity <= p.min_quantity);
  const byVendor = VENDORS.reduce((acc, v) => {
    const prods = lowStock.filter(p => p.vendor_company === v);
    if (prods.length) acc[v] = prods;
    return acc;
  }, {} as Record<string, any[]>);
  const otherLow = lowStock.filter(p => !VENDORS.includes(p.vendor_company ?? ''));
  if (otherLow.length) byVendor['Other'] = otherLow;

  const generateOrder = async (vendorName: string) => {
    setGenerating(vendorName);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: vendorName, vendor_company: vendorName }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to generate order'); return; }
      await load();
      // Auto-expand the new order
      const { data: newOrder } = await createClient().from('purchase_orders').select('id').eq('store_id', store?.id ?? '').order('created_at', { ascending: false }).limit(1).single();
      if (newOrder) loadOrderItems(newOrder.id);
    } catch (err: any) { alert(err.message); }
    finally { setGenerating(null); }
  };

  const loadOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) { setExpanded(expanded === orderId ? null : orderId); return; }
    const { data } = await createClient().from('purchase_order_items').select('*').eq('order_id', orderId).order('ai_reason');
    setOrderItems(prev => ({ ...prev, [orderId]: data ?? [] }));
    setExpanded(orderId);
  };

  const exportPO = (order: any, items: any[]) => {
    const lines = [
      `PURCHASE ORDER — ${order.vendor_name}`,
      `Generated: ${format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}`,
      `PO Total: ${fmt.currency(order.total)}`,
      `AI Notes: ${order.ai_notes ?? '—'}`,
      '',
      'Product,SKU,Barcode,Dept,Current Stock,Order Qty,Cases,Unit Cost,Line Total,Reason',
      ...items.map(i => `"${i.product_name}",${i.sku ?? ''},${i.barcode ?? ''},${i.department ?? ''},${i.current_stock},${i.order_qty},${i.cases},${fmt.currency(i.unit_cost)},${fmt.currency(i.line_total)},"${i.ai_reason ?? ''}"`)
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `PO-${order.vendor_name}-${format(new Date(order.created_at), 'yyyy-MM-dd')}.csv`; a.click();
  };

  return (
    <Screen title="AI Ordering" subtitle="Smart reorders based on 30/60/90-day sales velocity">
      <div className="space-y-5">

        {/* Upload sales report for better AI recommendations */}
        {!salesLoaded && (
          <div className="tile p-4 border-l-4 border-l-violet-500">
            <p className="text-sm font-bold text-text mb-1">📊 Upload Sales Report (Optional)</p>
            <p className="text-xs text-muted mb-3">AI uses your Modisoft report to calculate exact sales velocity per product for smarter order quantities</p>
            <MultiScan endpoint="/api/scan-report" onResult={() => { setSalesLoaded(true); load(); }}
              title="Upload Modisoft Report" hint="AI reads sales data to improve order accuracy" />
          </div>
        )}
        {salesLoaded && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">✓ Sales data loaded — AI will use velocity data for all orders</div>}

        {/* Low stock alert summary */}
        {lowStock.length > 0 && (
          <div className={cn('tile p-4 border-2', lowStock.filter(p => p.quantity === 0).length > 0 ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50')}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              <p className="font-bold text-text">{lowStock.length} products need reordering</p>
            </div>
            <p className="text-sm text-muted">
              {lowStock.filter(p => p.quantity === 0).length} out of stock ·{' '}
              {lowStock.filter(p => p.quantity > 0).length} running low
            </p>
          </div>
        )}

        {/* Vendor cards */}
        <div>
          <p className="section-title">Order by Vendor</p>
          {loading && <div className="tile p-10 text-center"><Loader2 className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}

          {!loading && Object.keys(byVendor).length === 0 && (
            <div className="tile p-10 text-center">
              <Package className="h-10 w-10 text-dim mx-auto mb-3" />
              <p className="font-bold text-text mb-1">All products are stocked</p>
              <p className="text-muted text-sm">No low-stock items detected right now</p>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(byVendor).map(([vendor, prods]) => {
              const outCount = prods.filter(p => p.quantity === 0).length;
              const estCost  = prods.reduce((s, p) => s + Number(p.unit_cost) * Math.max(p.reorder_qty || p.min_quantity * 2, 12), 0);
              return (
                <div key={vendor} className="tile overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-black text-text text-lg">{vendor}</p>
                        <p className="text-sm text-muted mt-0.5">
                          {prods.length} product{prods.length !== 1 ? 's' : ''} to order
                          {outCount > 0 && <span className="ml-2 text-accent font-semibold">· {outCount} OUT OF STOCK</span>}
                        </p>
                        <p className="text-xs text-muted mt-0.5">Est. order cost: {fmt.currency(estCost)}</p>
                      </div>
                      <button onClick={() => generateOrder(vendor)} disabled={!!generating}
                        className={cn('btn text-sm px-4 py-2.5 shrink-0', generating === vendor ? 'btn-ghost' : 'btn-accent')}>
                        {generating === vendor ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing…</> : <><Brain className="h-4 w-4" />Generate AI Order</>}
                      </button>
                    </div>

                    {/* Product list */}
                    <div className="space-y-2">
                      {prods.slice(0, 4).map(p => (
                        <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">{p.name}</p>
                            <p className="text-xs text-muted">{p.department ?? '—'} · Cost {fmt.currency(p.unit_cost)}</p>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className={cn('num font-black text-lg', p.quantity === 0 ? 'text-accent' : 'text-amber-600')}>{p.quantity}</span>
                            <p className="text-[10px] text-muted">/ min {p.min_quantity}</p>
                          </div>
                        </div>
                      ))}
                      {prods.length > 4 && <p className="text-xs text-muted text-center py-1">+{prods.length - 4} more products</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generated Purchase Orders */}
        {orders.length > 0 && (
          <div>
            <p className="section-title">Purchase Orders</p>
            <div className="space-y-3">
              {orders.map(order => {
                const isOpen = expanded === order.id;
                const items = orderItems[order.id] ?? [];
                return (
                  <div key={order.id} className="tile overflow-hidden">
                    <button onClick={() => loadOrderItems(order.id)} className="w-full p-5 text-left hover:bg-surface transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-text">{order.vendor_name}</p>
                            {order.ai_generated && <span className="chip bg-violet-100 text-violet-700 text-[10px]">🤖 AI</span>}
                            <span className={cn('chip text-[10px]',
                              order.status === 'draft' ? 'chip-gray' :
                              order.status === 'sent' ? 'chip-blue' :
                              order.status === 'received' ? 'chip-green' : 'chip-gray')}>
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted">{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</p>
                          {order.ai_notes && <p className="text-xs text-muted mt-1 italic">{order.ai_notes}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="num font-black text-text text-lg">{fmt.currency(order.total)}</p>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-muted ml-auto mt-1" /> : <ChevronDown className="h-4 w-4 text-muted ml-auto mt-1" />}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border">
                        {items.length === 0
                          ? <p className="px-5 py-4 text-sm text-muted">Loading items…</p>
                          : (
                            <>
                              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                                {items.map(item => (
                                  <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-text">{item.product_name}</p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-xs text-muted">Stock: {item.current_stock}</span>
                                        <span className="text-xs text-muted">·</span>
                                        <span className="text-xs text-muted">30d sold: {Number(item.velocity_30d).toFixed(0)}</span>
                                        <span className="text-xs text-muted">·</span>
                                        <span className="text-xs text-muted">90d sold: {Number(item.velocity_90d).toFixed(0)}</span>
                                        {item.days_of_supply && <span className="text-xs text-muted">· {item.days_of_supply}d supply</span>}
                                      </div>
                                      {item.ai_reason && <p className="text-xs text-violet-600 mt-0.5 italic">{item.ai_reason}</p>}
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="num font-black text-text">{item.order_qty} units</p>
                                      <p className="text-xs text-muted">{item.cases} cases</p>
                                      <p className="num text-xs font-semibold text-text">{fmt.currency(item.line_total)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-surface">
                                <p className="font-black text-text">Total: {fmt.currency(order.total)}</p>
                                <button onClick={() => exportPO(order, items)} className="btn btn-ghost text-sm gap-2 px-4">
                                  <Download className="h-4 w-4" />Export CSV
                                </button>
                              </div>
                            </>
                          )}
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
