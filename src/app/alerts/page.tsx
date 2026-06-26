'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Bell, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export default function AlertsPage() {
  const { store } = useStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const { data: inv } = await sb.from('invoices').select('*').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW').order('created_at', { ascending: false });
    const ids = (inv ?? []).map(i => i.id);
    let items: any[] = [];
    if (ids.length > 0) {
      const { data } = await sb.from('invoice_items').select('*').in('invoice_id', ids).eq('price_changed', true);
      items = data ?? [];
    }
    setInvoices(inv ?? []); setAllItems(items); setLoading(false);
  }, [store]);
  useEffect(() => { fetch(); }, [fetch]);

  const dismiss = async (invoiceId: string) => {
    await createClient().from('invoices').update({ status: 'COMPLETED' }).eq('id', invoiceId);
    fetch();
  };

  const totalChanges = allItems.length;
  const priceIncreases = allItems.filter(i => Number(i.unit_cost) > Number(i.old_cost ?? 0)).length;

  return (
    <Screen title="Price Alerts" subtitle={`${totalChanges} price change${totalChanges !== 1 ? 's' : ''} detected`}>
      <div className="space-y-5">
        {/* Summary */}
        {totalChanges > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="tile p-4 border border-accent/20">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-accent" /><p className="text-xs text-muted">Price Increases</p></div>
              <p className="num text-2xl font-bold text-accent">{priceIncreases}</p>
            </div>
            <div className="tile p-4 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-green-400" /><p className="text-xs text-muted">Price Drops</p></div>
              <p className="num text-2xl font-bold text-green-400">{totalChanges - priceIncreases}</p>
            </div>
          </div>
        )}

        {loading && <p className="text-center text-muted py-10">Loading…</p>}
        {!loading && invoices.length === 0 && (
          <div className="tile p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10"><Bell className="h-7 w-7 text-green-400" /></div>
            <p className="font-semibold text-text mb-1">All clear!</p>
            <p className="text-muted text-sm">No price change alerts. Upload an invoice to check.</p>
          </div>
        )}

        {invoices.map(inv => {
          const invItems = allItems.filter(i => i.invoice_id === inv.id);
          return (
            <div key={inv.id} className="tile overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <div>
                  <p className="font-semibold text-text">{inv.vendor_name ?? 'Invoice'}</p>
                  <p className="text-xs text-muted">{inv.vendor_company ? `${inv.vendor_company} · ` : ''}{format(new Date(inv.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip-yellow">{invItems.length} changes</span>
                  <button onClick={() => dismiss(inv.id)} className="p-2 text-muted hover:text-green-400 transition-colors"><Check className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {invItems.map(item => {
                  const up = Number(item.unit_cost) > Number(item.old_cost ?? 0);
                  const diff = Number(item.unit_cost) - Number(item.old_cost ?? 0);
                  return (
                    <div key={item.id} className="list-row">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text">{item.raw_description}</p>
                        <p className="text-xs text-muted mt-0.5">{fmt.currency(item.old_cost ?? 0)} → {fmt.currency(item.unit_cost)}</p>
                      </div>
                      <div className={cn('flex items-center gap-1 chip', up ? 'chip-red' : 'chip-green')}>
                        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {up ? '+' : ''}{fmt.currency(diff)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
