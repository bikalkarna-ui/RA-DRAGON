'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Bell, AlertTriangle, TrendingUp, TrendingDown, Package, Zap, RefreshCw, Check, DollarSign, Clock, ChevronRight } from 'lucide-react';

type Tab = 'stock' | 'prices' | 'cash' | 'ai';

export default function AlertsPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('stock');
  const [notifs, setNotifs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    try {
      const sb = createClient();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [{ data: ns }, { data: invs }, { data: rpts }, { data: prods }] = await Promise.all([
        sb.from('notifications').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50),
        sb.from('invoices').select('*, invoice_items(*)').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW').order('created_at', { ascending: false }).limit(20),
        sb.from('daily_reports').select('*').eq('store_id', store.id).gte('report_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]).order('report_date', { ascending: false }),
        sb.from('products').select('*').eq('store_id', store.id).eq('is_active', true).order('quantity'),
      ]);
      setNotifs(ns ?? []);
      setInvoices(invs ?? []);
      setReports(rpts ?? []);
      setProducts(prods ?? []);
    } catch (e) { console.error(e); }
    setLoading(false); setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  const markRead = async (id: string) => {
    await createClient().from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.is_read).map(n => n.id);
    if (!unread.length) return;
    await createClient().from('notifications').update({ is_read: true }).in('id', unread);
    setNotifs(p => p.map(n => ({ ...n, is_read: true })));
  };

  if (!mounted) return null;

  const n = (v: any) => Number(v || 0);
  const outOfStock = products.filter(p => n(p.quantity) === 0);
  const critical   = products.filter(p => n(p.quantity) > 0 && n(p.quantity) <= Math.ceil(n(p.min_quantity) * 0.5));
  const lowStock   = products.filter(p => n(p.quantity) > n(p.min_quantity) * 0.5 && n(p.quantity) <= n(p.min_quantity));
  const priceChanges = invoices.flatMap(inv => (inv.invoice_items ?? []).filter((i: any) => i.price_changed).map((i: any) => ({ ...i, vendor_name: inv.vendor_name, invoice_date: inv.created_at, invoice_id: inv.id })));
  const cashIssues = reports.filter(r => Math.abs(n(r.drawer_difference)) > 5);
  const unreadAI   = notifs.filter(n => !n.is_read);

  const TABS = [
    { id: 'stock' as Tab,  label: '📦 Stock',  badge: outOfStock.length + critical.length },
    { id: 'prices' as Tab, label: '💰 Prices', badge: priceChanges.length },
    { id: 'cash' as Tab,   label: '💵 Cash',   badge: cashIssues.length },
    { id: 'ai' as Tab,     label: '🤖 AI',     badge: unreadAI.length },
  ];

  return (
    <Screen title="Alert Center"
      subtitle={`${outOfStock.length} out of stock · ${priceChanges.length} price changes · ${unreadAI.length} unread`}
      action={
        <button onClick={() => { setRefreshing(true); load(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      }>
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 relative rounded-xl py-2.5 text-xs font-bold border transition-colors',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
              {t.badge > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1">{t.badge}</span>}
            </button>
          ))}
        </div>

        {loading && <div className="tile p-10 text-center"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}

        {/* ── STOCK ── */}
        {!loading && tab === 'stock' && (
          <>
            {outOfStock.length === 0 && critical.length === 0 && lowStock.length === 0 ? (
              <div className="tile p-10 text-center"><div className="text-4xl mb-3">✅</div><p className="font-bold text-gray-700">All stock levels look good</p></div>
            ) : (
              <>
                {[
                  { title: '🔴 Out of Stock', items: outOfStock, color: 'border-l-red-500', bg: 'bg-red-50', chip: 'chip-red', msg: 'Order immediately' },
                  { title: '🟠 Critical — Order Now', items: critical, color: 'border-l-orange-500', bg: 'bg-orange-50', chip: 'chip-red', msg: 'Very low stock' },
                  { title: '🟡 Low Stock — Order Soon', items: lowStock, color: 'border-l-amber-400', bg: 'bg-amber-50', chip: 'chip-yellow', msg: 'Below minimum' },
                ].filter(g => g.items.length > 0).map(group => (
                  <div key={group.title} className="tile overflow-hidden">
                    <div className={cn('px-5 py-3 border-b border-border', group.bg)}>
                      <p className="text-sm font-bold text-text">{group.title} ({group.items.length})</p>
                    </div>
                    {group.items.map(p => (
                      <div key={p.id} className={cn('px-5 py-4 flex items-center justify-between border-b border-border/50 last:border-0 border-l-4', group.color)}>
                        <div>
                          <p className="font-semibold text-text text-sm">{p.name}</p>
                          <p className="text-xs text-muted mt-0.5">{p.vendor_company ?? '—'} · Min: {p.min_quantity} · Reorder: {p.reorder_qty || '—'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('num font-black text-xl', p.quantity === 0 ? 'text-red-700' : 'text-amber-700')}>{p.quantity}</p>
                          <p className="text-[10px] text-muted">units left</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── PRICES ── */}
        {!loading && tab === 'prices' && (
          <>
            {priceChanges.length === 0 ? (
              <div className="tile p-10 text-center"><div className="text-4xl mb-3">✅</div><p className="font-bold text-gray-700">No price changes detected</p></div>
            ) : (
              <div className="tile overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-blue-50">
                  <p className="text-sm font-bold text-blue-800">{priceChanges.length} price change{priceChanges.length > 1 ? 's' : ''} need review</p>
                </div>
                {priceChanges.map((item, i) => {
                  const oldCost = n(item.unit_cost_old || item.old_unit_cost);
                  const newCost = n(item.unit_cost || item.new_unit_cost);
                  const diff = newCost - oldCost;
                  const pct = oldCost > 0 ? (diff / oldCost * 100) : 0;
                  return (
                    <div key={i} className="px-5 py-4 border-b border-border/50 last:border-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-text text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted mt-0.5">{item.vendor_name} · {(() => { try { return new Date(item.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return '—'; } })()}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <div className="flex items-center gap-2">
                            <span className="num text-sm text-muted line-through">{fmt.currency(oldCost)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="num font-bold text-text">{fmt.currency(newCost)}</span>
                          </div>
                          <div className={cn('flex items-center gap-1 justify-end mt-1', diff > 0 ? 'text-red-600' : 'text-green-600')}>
                            {diff > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            <span className="text-xs font-bold">{diff > 0 ? '+' : ''}{fmt.currency(diff)} ({pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      </div>
                      <a href="/invoices" className="mt-2 inline-flex items-center gap-1 text-xs text-accent font-semibold hover:underline">
                        Review Invoice <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── CASH ── */}
        {!loading && tab === 'cash' && (
          <>
            {cashIssues.length === 0 ? (
              <div className="tile p-10 text-center"><div className="text-4xl mb-3">✅</div><p className="font-bold text-gray-700">All drawers balanced this week</p></div>
            ) : (
              <div className="tile overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-red-50">
                  <p className="text-sm font-bold text-red-800">{cashIssues.length} cash discrepanc{cashIssues.length > 1 ? 'ies' : 'y'} this week</p>
                </div>
                {cashIssues.map(r => {
                  const diff = n(r.drawer_difference);
                  const isShort = diff < 0;
                  return (
                    <div key={r.id} className="px-5 py-4 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text text-sm">{(() => { try { return new Date(r.report_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch { return r.report_date; } })()}</p>
                          <p className="text-xs text-muted mt-0.5">Expected: {fmt.currency(n(r.expected_cash))} · Actual: {fmt.currency(n(r.actual_cash))}</p>
                        </div>
                        <div className={cn('rounded-xl px-3 py-1.5 text-center', isShort ? 'bg-red-100' : 'bg-green-100')}>
                          <p className={cn('num font-black text-lg', isShort ? 'text-red-700' : 'text-green-700')}>{diff >= 0 ? '+' : ''}{fmt.currency(diff)}</p>
                          <p className={cn('text-[10px] font-bold', isShort ? 'text-red-600' : 'text-green-600')}>{isShort ? 'SHORT' : 'OVER'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── AI ALERTS ── */}
        {!loading && tab === 'ai' && (
          <>
            {unreadAI.length > 0 && (
              <button onClick={markAllRead} className="btn btn-ghost btn-full text-sm gap-2"><Check className="h-4 w-4" />Mark all read</button>
            )}
            {notifs.length === 0 ? (
              <div className="tile"><EmptyState icon={Zap} title="No AI alerts yet" description="Alerts appear when AI detects issues in your store data." color="amber" /></div>
            ) : (
              <div className="tile overflow-hidden divide-y divide-border/50">
                {notifs.map(n => (
                  <div key={n.id} className={cn('px-5 py-4 flex items-start gap-3', !n.is_read && 'bg-violet-50/50')}>
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                      n.type === 'out_of_stock' ? 'bg-red-100 text-red-600' :
                      n.type === 'low_stock' ? 'bg-amber-100 text-amber-600' :
                      'bg-violet-100 text-violet-600')}>
                      {n.type === 'out_of_stock' || n.type === 'low_stock' ? <Package className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5">{n.message}</p>
                      {n.action_label && n.action_url && <a href={n.action_url} className="text-xs text-accent font-semibold mt-1.5 inline-block hover:underline">{n.action_label} →</a>}
                    </div>
                    {!n.is_read && <button onClick={() => markRead(n.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600"><Check className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
