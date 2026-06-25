'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDOR_COMPANIES } from '@/lib/utils';
import { Brain, Loader2, Check, X, ChevronDown, ChevronUp, Send, Package } from 'lucide-react';
import { BarcodeScanner, ScanToast } from '@/components/ui/barcode-scanner';

interface Vendor { id: string; company_name: string; rep_name: string | null; phone: string | null; is_preset: boolean; }
interface Order { id: string; vendor_name: string; status: string; ai_generated: boolean; ai_reasoning: string | null; total_estimated: number; created_at: string; }
interface OrderItem { id: string; product_name: string; sku: string | null; current_stock: number; suggested_qty: number; approved_qty: number | null; unit_cost: number; line_total: number; reason: string | null; }

export default function OrderingPage() {
  const { store } = useStore();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [scanResult, setScanResult] = useState<{ barcode: string; product: any } | null>(null);
  const [scanInfo, setScanInfo] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: v }, { data: o }] = await Promise.all([
      sb.from('vendors').select('*').eq('store_id', store.id).order('company_name'),
      sb.from('vendor_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setVendors((v as Vendor[]) ?? []);
    setOrders((o as Order[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleScan = (result: { barcode: string; product: any }) => {
    setScanResult(result);
    if (result.product) {
      // Show which vendor this product belongs to and its stock
      setScanInfo(result.product);
    }
  };

  const generateOrder = async (vendor: Vendor) => {
    setGenerating(vendor.id); setError(null);
    try {
      const res = await fetch('/api/ai-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: vendor.id, vendorName: vendor.company_name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      await fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setGenerating(null); }
  };

  const loadOrderItems = async (orderId: string) => {
    if (orderItems[orderId]) { setExpandedOrder(expandedOrder === orderId ? null : orderId); return; }
    const { data } = await createClient().from('vendor_order_items').select('*').eq('order_id', orderId).order('product_name');
    setOrderItems(prev => ({ ...prev, [orderId]: (data as OrderItem[]) ?? [] }));
    setExpandedOrder(orderId);
  };

  const updateQty = async (itemId: string, orderId: string, qty: number) => {
    await createClient().from('vendor_order_items').update({ approved_qty: qty }).eq('id', itemId);
    setOrderItems(prev => ({ ...prev, [orderId]: (prev[orderId] ?? []).map(i => i.id === itemId ? { ...i, approved_qty: qty } : i) }));
  };

  const approveOrder = async (orderId: string) => { await createClient().from('vendor_orders').update({ status: 'approved' }).eq('id', orderId); fetchData(); };
  const sentOrder = async (orderId: string) => { await createClient().from('vendor_orders').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', orderId); fetchData(); };
  const deleteOrder = async (orderId: string) => { if (!confirm('Delete this order?')) return; await createClient().from('vendor_orders').delete().eq('id', orderId); fetchData(); };

  const STATUS_STYLE: Record<string, string> = {
    draft: 'bg-obsidian-800 text-obsidian-300',
    approved: 'bg-gold-900/30 text-gold-400',
    sent: 'bg-fire-900/30 text-fire-400',
    received: 'bg-obsidian-700 text-obsidian-200',
  };

  return (
    <AppShell title="AI Smart Ordering" storeName={store?.name}>
      <div className="space-y-6">
        {scanResult && (
          <ScanToast barcode={scanResult.barcode} product={scanResult.product} onClose={() => { setScanResult(null); setScanInfo(null); }} />
        )}

        {/* Scanner bar */}
        <div className="d-card p-4 border-fire-900/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Brain className="h-4 w-4 text-fire-500 shrink-0" />
              <p className="text-sm font-medium text-white">Scan a product to see which vendor to reorder from</p>
            </div>
            {store && (
              <BarcodeScanner storeId={store.id} onScan={handleScan} placeholder="Scan product barcode…" className="flex-1 min-w-48" />
            )}
          </div>
          {scanInfo && (
            <div className="mt-3 rounded-lg bg-obsidian-900/60 border border-dragon-border p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white text-sm">{scanInfo.name}</p>
                <p className="text-xs text-obsidian-400 mt-0.5">
                  Stock: <span className={cn('font-bold', scanInfo.quantity <= scanInfo.min_quantity ? 'text-fire-400' : 'text-white')}>{scanInfo.quantity}</span>
                  {scanInfo.vendor_company && <> · Vendor: <span className="text-fire-400">{scanInfo.vendor_company}</span></>}
                </p>
              </div>
              {scanInfo.vendor_company && (
                <button
                  onClick={() => { const v = vendors.find(x => x.company_name === scanInfo.vendor_company); if (v) generateOrder(v); setScanInfo(null); }}
                  className="btn-fire text-xs py-1.5 px-3 shrink-0">
                  <Brain className="h-3.5 w-3.5" />Generate {scanInfo.vendor_company} Order
                </button>
              )}
            </div>
          )}
        </div>

        <div className="d-card p-5 border-fire-900/40">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-fire-500" />
            <h2 className="font-bold text-white">Generate Company-Wise Orders</h2>
          </div>
          {error && <div className="mb-4 rounded-lg bg-fire-950/50 border border-fire-900/50 px-3 py-2 text-sm text-fire-400">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {vendors.map(vendor => {
              const vc = VENDOR_COMPANIES.find(v => v.name === vendor.company_name);
              const isGenerating = generating === vendor.id;
              return (
                <div key={vendor.id} className="d-card p-4 hover:border-fire-800/50 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{vc?.emoji ?? '⚪'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{vendor.company_name}</p>
                      {vendor.rep_name && <p className="text-xs text-obsidian-500 truncate">{vendor.rep_name}</p>}
                    </div>
                  </div>
                  <button onClick={() => generateOrder(vendor)} disabled={!!generating}
                    className={cn('w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all', isGenerating ? 'bg-fire-900/50 text-fire-400' : 'btn-fire')}>
                    {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                    {isGenerating ? 'Analyzing…' : 'Generate Order'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">Order History</h3>
          {loading && <p className="text-sm text-obsidian-500">Loading…</p>}
          {!loading && orders.length === 0 && (
            <div className="d-card p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-obsidian-700 mb-3" />
              <p className="text-sm text-obsidian-500">No orders yet. Scan a product or click "Generate Order" above.</p>
            </div>
          )}
          <div className="space-y-3">
            {orders.map(order => {
              const vc = VENDOR_COMPANIES.find(v => v.name === order.vendor_name);
              const isExpanded = expandedOrder === order.id;
              const items = orderItems[order.id] ?? [];
              return (
                <div key={order.id} className="d-card overflow-hidden">
                  <button onClick={() => loadOrderItems(order.id)} className="w-full flex items-center justify-between p-4 hover:bg-obsidian-900/30 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{vc?.emoji ?? '⚪'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{order.vendor_name}</p>
                          {order.ai_generated && <span className="d-badge bg-fire-900/30 text-fire-400 text-[10px]"><Brain className="h-2.5 w-2.5" />AI</span>}
                          <span className={cn('d-badge text-[10px]', STATUS_STYLE[order.status] ?? 'bg-obsidian-800 text-obsidian-300')}>{order.status}</span>
                        </div>
                        <p className="text-xs text-obsidian-500 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="mono font-bold text-fire-400">{fmt.currency(order.total_estimated)}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-obsidian-500" /> : <ChevronDown className="h-4 w-4 text-obsidian-500" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-dragon-border">
                      {order.ai_reasoning && (
                        <div className="px-4 py-3 bg-fire-950/30 border-b border-dragon-border">
                          <p className="text-xs text-obsidian-400"><span className="text-fire-400 font-medium">AI: </span>{order.ai_reasoning}</p>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-obsidian-900/50">
                            <tr>{['Product','Current Stock','Suggested','Approved Qty','Unit Cost','Total','Why'].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-obsidian-500">{h}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-dragon-border">
                            {items.map(item => (
                              <tr key={item.id} className="hover:bg-obsidian-900/20">
                                <td className="px-4 py-2.5 font-medium text-white">{item.product_name}</td>
                                <td className="mono px-4 py-2.5 text-center"><span className={cn('d-badge text-xs', item.current_stock === 0 ? 'bg-fire-900/40 text-fire-400' : 'bg-gold-900/20 text-gold-400')}>{item.current_stock}</span></td>
                                <td className="mono px-4 py-2.5 text-center text-obsidian-300">{item.suggested_qty}</td>
                                <td className="px-4 py-2.5">
                                  <input type="number" min="0" defaultValue={item.approved_qty ?? item.suggested_qty}
                                    onBlur={e => updateQty(item.id, order.id, parseInt(e.target.value, 10) || 0)}
                                    className="w-16 h-7 rounded bg-obsidian-800 border border-dragon-border px-2 text-xs mono text-white text-center focus:border-fire-700 focus:outline-none" />
                                </td>
                                <td className="mono px-4 py-2.5 text-obsidian-400">{fmt.currency(item.unit_cost)}</td>
                                <td className="mono px-4 py-2.5 text-fire-400">{fmt.currency(item.line_total)}</td>
                                <td className="px-4 py-2.5 text-xs text-obsidian-500 max-w-40 truncate">{item.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2 p-4 border-t border-dragon-border">
                        {order.status === 'draft' && <button onClick={() => approveOrder(order.id)} className="btn-fire text-xs py-1.5 px-3"><Check className="h-3.5 w-3.5" />Approve</button>}
                        {order.status === 'approved' && <button onClick={() => sentOrder(order.id)} className="btn-fire text-xs py-1.5 px-3"><Send className="h-3.5 w-3.5" />Mark Sent</button>}
                        <button onClick={() => deleteOrder(order.id)} className="btn-ghost text-xs py-1.5 px-3"><X className="h-3.5 w-3.5" />Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
