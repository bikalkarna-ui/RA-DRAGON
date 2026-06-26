'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Bell, Check, TrendingUp, TrendingDown, AlertTriangle, Package, Zap, Brain, RefreshCw } from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';
import { format } from 'date-fns';

type NotifType = 'out_of_stock' | 'critical' | 'low_stock' | 'overstock' | 'price_change' | 'reorder_suggestion';

const NOTIF_CONFIG: Record<string, { icon: string; bg: string; border: string; text: string; label: string }> = {
  out_of_stock:       { icon: '🔴', bg: 'bg-red-50',    border: 'border-l-red-500',    text: 'text-red-700',    label: 'Out of Stock'  },
  critical:           { icon: '🟠', bg: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700', label: 'Critical'      },
  low_stock:          { icon: '🟡', bg: 'bg-amber-50',  border: 'border-l-amber-400',  text: 'text-amber-700',  label: 'Low Stock'     },
  overstock:          { icon: '🔵', bg: 'bg-blue-50',   border: 'border-l-blue-400',   text: 'text-blue-700',   label: 'Overstocked'   },
  price_change:       { icon: '💰', bg: 'bg-purple-50', border: 'border-l-purple-400', text: 'text-purple-700', label: 'Price Change'  },
  reorder_suggestion: { icon: '🤖', bg: 'bg-violet-50', border: 'border-l-violet-400', text: 'text-violet-700', label: 'AI Suggestion' },
};

function getRecommendation(n: any): string {
  const data = n.data ?? {};
  switch (n.type) {
    case 'out_of_stock':
      return `Order immediately from ${data.vendor ?? 'your vendor'}. Every hour without stock costs sales.`;
    case 'critical':
      return `Only ${data.quantity} units left. Order at least ${Math.max((data.min_quantity ?? 5) * 3, 12)} units now.`;
    case 'low_stock':
      return `${data.quantity} units remaining (min: ${data.min_quantity}). Schedule a reorder this week.`;
    case 'overstock':
      return `${data.quantity} units on hand (max: ${data.max_quantity}). Consider a promotion to move excess.`;
    default:
      return '';
  }
}

export default function AlertsPage() {
  const { store } = useStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [priceInvoices, setPriceInvoices] = useState<any[]>([]);
  const [priceItems, setPriceItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stock' | 'prices'>('stock');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setRefreshing(true);
    const sb = createClient();

    // Pull notifications from API (also auto-generates them)
    const [notifRes, { data: inv }] = await Promise.all([
      fetch('/api/notifications'),
      sb.from('invoices').select('*').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW').order('created_at', { ascending: false }),
    ]);
    const notifData = await notifRes.json();
    setNotifications(notifData.notifications ?? []);

    const ids = (inv ?? []).map((i: any) => i.id);
    let items: any[] = [];
    if (ids.length > 0) {
      const { data } = await sb.from('invoice_items').select('*').in('invoice_id', ids).eq('price_changed', true);
      items = data ?? [];
    }
    setPriceInvoices(inv ?? []);
    setPriceItems(items);
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  const dismissNotif = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
    setNotifications(n => n.filter(x => x.id !== id));
  };

  const dismissAll = async () => {
    const ids = stockNotifs.map(n => n.id);
    if (ids.length > 0) await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    setNotifications(n => n.filter(x => !ids.includes(x.id)));
  };

  const dismissInvoice = async (invoiceId: string) => {
    await createClient().from('invoices').update({ status: 'COMPLETED' }).eq('id', invoiceId);
    load();
  };

  const stockNotifs = notifications.filter(n => ['out_of_stock', 'critical', 'low_stock', 'overstock'].includes(n.type));
  const outCount = stockNotifs.filter(n => n.type === 'out_of_stock').length;
  const critCount = stockNotifs.filter(n => n.type === 'critical').length;
  const lowCount  = stockNotifs.filter(n => n.type === 'low_stock').length;
  const overCount = stockNotifs.filter(n => n.type === 'overstock').length;
  const totalPriceChanges = priceItems.length;
  const priceUp = priceItems.filter(i => Number(i.unit_cost) > Number(i.old_cost ?? 0)).length;

  return (
    <Screen title="Alerts & Notifications"
      subtitle={`${stockNotifs.length} stock · ${totalPriceChanges} price changes`}
      action={
        <button onClick={load} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      }>
      <div className="space-y-5">

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Out',      count: outCount,  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'    },
            { label: 'Critical', count: critCount,  color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
            { label: 'Low',      count: lowCount,   color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
            { label: 'Prices',   count: totalPriceChanges, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
          ].map(s => (
            <div key={s.label} className={cn('tile p-3 text-center border', s.border, s.bg)}>
              <p className={cn('num text-2xl font-black', s.color)}>{s.count}</p>
              <p className="text-xs text-muted mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('stock')}
            className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
              tab === 'stock' ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
            📦 Stock Alerts ({stockNotifs.length})
          </button>
          <button onClick={() => setTab('prices')}
            className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
              tab === 'prices' ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
            💰 Price Changes ({totalPriceChanges})
          </button>
        </div>

        {/* ── STOCK ALERTS ── */}
        {tab === 'stock' && (
          <div className="space-y-3">
            {loading && <p className="text-center text-muted py-10">Checking inventory…</p>}

            {!loading && stockNotifs.length === 0 && (
              <div className="tile p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Package className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-bold text-text text-lg mb-1">All stock levels OK</p>
                <p className="text-muted text-sm">No low stock or out-of-stock alerts right now.</p>
              </div>
            )}

            {stockNotifs.length > 0 && (
              <div className="flex justify-end">
                <button onClick={dismissAll} className="text-xs text-accent font-semibold underline">Dismiss all</button>
              </div>
            )}

            {stockNotifs.map(n => {
              const cfg = NOTIF_CONFIG[n.type] ?? NOTIF_CONFIG.low_stock;
              const rec = getRecommendation(n);
              return (
                <div key={n.id} className={cn('tile overflow-hidden border-l-4', cfg.border, n.is_read ? 'opacity-60' : '')}>
                  <div className={cn('px-4 py-4', cfg.bg)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="text-xl shrink-0">{cfg.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn('text-sm font-black', cfg.text)}>{n.title}</p>
                            <span className={cn('chip text-[10px]', cfg.text, cfg.bg, 'border border-current/20')}>{cfg.label}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                        </div>
                      </div>
                      <button onClick={() => dismissNotif(n.id)} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/60 text-gray-400 hover:text-gray-700 transition-colors">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* AI Recommendation */}
                    {rec && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 border border-white px-3 py-2.5">
                        <Zap className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wide mb-0.5">AI Recommendation</p>
                          <p className="text-xs text-gray-700 leading-relaxed">{rec}</p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      <a href="/ordering" className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 transition-colors">
                        <Brain className="h-3.5 w-3.5" />Generate Order
                      </a>
                      <a href="/inventory" className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                        <Package className="h-3.5 w-3.5" />View Inventory
                      </a>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[10px] text-muted">{format(new Date(n.created_at), 'MMM d · h:mm a')}</p>
                    {n.data?.quantity !== undefined && (
                      <p className="text-[10px] text-muted">Current: <span className="font-bold">{n.data.quantity}</span> units · Min: <span className="font-bold">{n.data.min_quantity}</span></p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PRICE CHANGES ── */}
        {tab === 'prices' && (
          <div className="space-y-3">
            {totalPriceChanges > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="tile p-4 border border-red-100">
                  <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-accent" /><p className="text-xs text-muted font-medium">Price Increases</p></div>
                  <p className="num text-3xl font-black text-accent">{priceUp}</p>
                  <p className="text-xs text-muted mt-1">vendors charged you more</p>
                </div>
                <div className="tile p-4 border border-green-100">
                  <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-green-600" /><p className="text-xs text-muted font-medium">Price Drops</p></div>
                  <p className="num text-3xl font-black text-green-700">{totalPriceChanges - priceUp}</p>
                  <p className="text-xs text-muted mt-1">vendors lowered cost</p>
                </div>
              </div>
            )}

            {/* Upload invoice to detect price changes */}
            <MultiScan
              endpoint="/api/scan-invoice"
              onResult={() => load()}
              title="📸 Scan Vendor Invoice"
              hint="AI reads the invoice and automatically detects any price changes"
            />

            {!loading && priceInvoices.length === 0 && (
              <div className="tile p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Bell className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-bold text-text text-lg mb-1">No price change alerts</p>
                <p className="text-muted text-sm">Upload a vendor invoice to detect price changes automatically.</p>
                <a href="/invoices" className="btn btn-accent mt-4 px-6 inline-flex">Upload Invoice</a>
              </div>
            )}

            {priceInvoices.map(inv => {
              const invItems = priceItems.filter(i => i.invoice_id === inv.id);
              return (
                <div key={inv.id} className="tile overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-purple-50">
                    <div>
                      <p className="font-bold text-gray-900">{inv.vendor_name ?? 'Invoice'}</p>
                      <p className="text-xs text-gray-500">{inv.vendor_company ? `${inv.vendor_company} · ` : ''}{format(new Date(inv.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="chip chip-yellow">{invItems.length} change{invItems.length > 1 ? 's' : ''}</span>
                      <button onClick={() => dismissInvoice(inv.id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-border/60">
                    {invItems.map(item => {
                      const up = Number(item.unit_cost) > Number(item.old_cost ?? 0);
                      const diff = Number(item.unit_cost) - Number(item.old_cost ?? 0);
                      const pct = item.old_cost ? Math.abs(diff / Number(item.old_cost) * 100) : 0;
                      return (
                        <div key={item.id} className={cn('px-4 py-3', up ? 'bg-red-50/40' : 'bg-green-50/40')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.raw_description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="num text-xs text-gray-400 line-through">{fmt.currency(item.old_cost ?? 0)}</span>
                                <span className="text-gray-400">→</span>
                                <span className="num text-sm font-bold text-gray-900">{fmt.currency(item.unit_cost)}</span>
                                <span className={cn('chip text-[10px]', up ? 'chip-red' : 'chip-green')}>
                                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {up ? '+' : '-'}{fmt.currency(Math.abs(diff))} ({pct.toFixed(1)}%)
                                </span>
                              </div>
                              {up && (
                                <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                                  <Zap className="h-3 w-3" />Update your sell price to maintain your margin
                                </p>
                              )}
                            </div>
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
      </div>
    </Screen>
  );
}
