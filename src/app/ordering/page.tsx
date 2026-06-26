'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { AIUpload } from '@/components/ui/ai-upload';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDORS } from '@/lib/utils';
import { Brain, Loader2, Check, X, ChevronDown, ChevronUp, Send, Package } from 'lucide-react';

export default function OrderingPage() {
  const { store } = useStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});

  const fetchData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: v }, { data: o }] = await Promise.all([
      sb.from('vendors').select('*').eq('store_id', store.id).order('company_name'),
      sb.from('vendor_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setVendors(v ?? []); setOrders(o ?? []); setLoading(false);
  }, [store]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const gen = async (vendor: any) => {
    setGenerating(vendor.id); setError(null);
    try {
      const res = await fetch('/api/ai-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendorId: vendor.id, vendorName: vendor.company_name }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      await fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setGenerating(null); }
  };

  const loadItems = async (id: string) => {
    if (orderItems[id]) { setExpanded(expanded === id ? null : id); return; }
    const { data } = await createClient().from('vendor_order_items').select('*').eq('order_id', id).order('product_name');
    setOrderItems(p => ({ ...p, [id]: data ?? [] })); setExpanded(id);
  };

  const approve = async (id: string) => { await createClient().from('vendor_orders').update({ status: 'approved' }).eq('id', id); fetchData(); };
  const del = async (id: string) => { if (!confirm('Delete?')) return; await createClient().from('vendor_orders').delete().eq('id', id); fetchData(); };

  const STATUS: Record<string, string> = { draft: 'chip-gray', approved: 'chip-yellow', sent: 'chip-blue', received: 'chip-green' };

  return (
    <Screen title="AI Smart Ordering" subtitle="Scan a product or pick a vendor — AI does the rest">
      <div className="space-y-6">

        {/* Upload report to improve AI */}
        <div className="tile p-5">
          <p className="text-sm font-semibold text-text mb-1">Upload Modisoft Report</p>
          <p className="text-xs text-muted mb-3">AI uses your sales data to suggest better order quantities</p>
          <AIUpload label="Upload Sales Report" description="PDF or photo of daily report" endpoint="/api/scan-report" onResult={() => {}} compact />
        </div>

        {error && <div className="tile p-4 border border-accent/30 bg-accent/5"><p className="text-accent text-sm">{error}</p></div>}

        {/* Vendor grid */}
        <div>
          <p className="section-title">Generate Order by Vendor</p>
          <div className="grid grid-cols-2 gap-3">
            {vendors.map(vendor => {
              const isGen = generating === vendor.id;
              return (
                <button key={vendor.id} onClick={() => gen(vendor)} disabled={!!generating}
                  className="tile p-5 text-left active:scale-95 transition-transform disabled:opacity-60">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 mb-3">
                    <Brain className={cn('h-5 w-5 text-violet-400', isGen && 'animate-pulse')} />
                  </div>
                  <p className="font-semibold text-text text-sm">{vendor.company_name}</p>
                  {vendor.rep_name && <p className="text-xs text-muted mt-0.5">{vendor.rep_name}</p>}
                  {isGen && <p className="text-xs text-violet-400 mt-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Analyzing…</p>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Order history */}
        {orders.length > 0 && (
          <div>
            <p className="section-title">Recent Orders</p>
            <div className="tile overflow-hidden divide-y divide-border/60">
              {orders.map(order => {
                const isExp = expanded === order.id;
                const oItems = orderItems[order.id] ?? [];
                return (
                  <div key={order.id}>
                    <button onClick={() => loadItems(order.id)} className="list-row w-full text-left">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                          <Brain className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2"><p className="text-sm font-semibold text-text">{order.vendor_name}</p><span className={STATUS[order.status] ?? 'chip-gray'}>{order.status}</span></div>
                          <p className="text-xs text-muted">{new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="num text-sm font-bold text-text">{fmt.currency(order.total_estimated)}</span>
                        {isExp ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                      </div>
                    </button>
                    {isExp && (
                      <div className="px-5 pb-4 border-t border-border/60">
                        {order.ai_reasoning && <p className="text-xs text-violet-300/70 py-3 border-b border-border/60 mb-3"><span className="text-violet-400 font-medium">AI: </span>{order.ai_reasoning}</p>}
                        <div className="space-y-2">
                          {oItems.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <div className="flex-1"><p className="font-medium text-text text-xs">{item.product_name}</p><p className="text-dim text-xs">Stock: {item.current_stock} → Order: {item.suggested_qty}</p></div>
                              <span className="num text-xs font-semibold text-text">{fmt.currency(item.line_total)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-4">
                          {order.status === 'draft' && <button onClick={() => approve(order.id)} className="btn btn-accent text-xs h-9 px-4"><Check className="h-3.5 w-3.5" />Approve</button>}
                          <button onClick={() => del(order.id)} className="btn btn-ghost text-xs h-9 px-3"><X className="h-3.5 w-3.5" />Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && orders.length === 0 && vendors.length === 0 && (
          <div className="tile p-10 text-center"><Package className="mx-auto h-10 w-10 text-dim mb-3" /><p className="text-muted text-sm">Tap a vendor above to generate your first AI order.</p></div>
        )}
      </div>
    </Screen>
  );
}
