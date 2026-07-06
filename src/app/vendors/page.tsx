'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, RefreshCw, Package } from 'lucide-react';

export default function VendorsPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const { data: products } = await sb.from('products').select('vendor_company,unit_cost,unit_price,name,last_received_at').eq('store_id', store.id).eq('is_active', true).not('vendor_company', 'is', null);
    const { data: invoices } = await sb.from('invoices').select('vendor_name,total_amount,created_at').eq('store_id', store.id).order('created_at', { ascending: false });

    // Group by vendor
    const vendorMap: Record<string,any> = {};
    (products||[]).forEach((p: any) => {
      const v = p.vendor_company;
      if (!v) return;
      if (!vendorMap[v]) vendorMap[v] = { name:v, products:[], totalValue:0, invoices:[] };
      vendorMap[v].products.push(p);
      vendorMap[v].totalValue += Number(p.unit_cost||0) * 1;
    });
    (invoices||[]).forEach((i: any) => {
      const v = i.vendor_name;
      if (!v || !vendorMap[v]) return;
      vendorMap[v].invoices.push(i);
    });

    setVendors(Object.values(vendorMap).sort((a,b) => b.products.length - a.products.length));
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);

  return (
    <Screen title="Vendor Management" subtitle="Track vendors and price changes">
      <div className="space-y-4">
        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}
        {!loading && vendors.length === 0 && (
          <div className="tile p-10 text-center"><Package className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted">No vendors found — add vendor names to your products in Inventory</p></div>
        )}
        {vendors.map(v => {
          const totalInvoiced = v.invoices.reduce((s:number,i:any) => s+n(i.total_amount),0);
          const lastOrder = v.invoices[0];
          return (
            <div key={v.name} className="tile p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-text">{v.name}</p>
                  <p className="text-xs text-muted">{v.products.length} products · {v.invoices.length} invoices</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold text-text">{fmt.currency(totalInvoiced)}</p>
                  <p className="text-xs text-muted">total invoiced</p>
                </div>
              </div>
              {lastOrder && (
                <div className="rounded-xl bg-surface p-3 text-xs text-muted">
                  Last order: {fmt.currency(n(lastOrder.total_amount))} · {(() => { try { return new Date(lastOrder.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return ''; } })()}
                </div>
              )}
              <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                {v.products.slice(0,5).map((p:any,i:number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-600 truncate">{p.name}</span>
                    <span className="num font-semibold text-text shrink-0 ml-2">{fmt.currency(n(p.unit_cost))}</span>
                  </div>
                ))}
                {v.products.length > 5 && <p className="text-xs text-muted">+{v.products.length-5} more products</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
