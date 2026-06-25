'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { TrendingUp, Package, AlertTriangle, DollarSign, RefreshCw, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { startOfDay, subDays, format, startOfWeek } from 'date-fns';

export default function DashboardPage() {
  const { store } = useStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  const fetchStats = useCallback(async (silent = false) => {
    if (!store) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const sb = createClient();
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const weekStart = startOfWeek(now).toISOString();
    const prev7 = subDays(now, 7).toISOString();

    const [{ data: todaySales }, { data: weeklySales }, { data: products }, { data: lowStock }] = await Promise.all([
      sb.from('sales').select('id,total,created_at,employee_name,payment_method').eq('store_id', store.id).gte('created_at', todayStart).order('created_at', { ascending: false }),
      sb.from('sales').select('id,total,created_at').eq('store_id', store.id).gte('created_at', weekStart),
      sb.from('products').select('id,name,unit_cost,unit_price,quantity,min_quantity,max_quantity,vendor_company').eq('store_id', store.id).eq('is_active', true),
      sb.from('products').select('id,name,quantity,min_quantity,vendor_company').eq('store_id', store.id).eq('is_active', true).lte('quantity', 5),
    ]);

    // Get sale items for category breakdown
    const todayIds = (todaySales ?? []).map(s => s.id);
    let categoryBreakdown: any[] = [];
    if (todayIds.length > 0) {
      const { data: items } = await sb.from('sale_items').select('category,vendor_company,line_total').in('sale_id', todayIds);
      const catMap = new Map<string, number>();
      for (const item of items ?? []) {
        const key = item.vendor_company ?? item.category ?? 'Other';
        catMap.set(key, (catMap.get(key) ?? 0) + Number(item.line_total));
      }
      categoryBreakdown = [...catMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    }

    // Hourly chart for today
    const hourMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`;
      hourMap.set(label, 0);
    }
    for (const s of todaySales ?? []) {
      const h = new Date(s.created_at).getHours();
      const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`;
      hourMap.set(label, (hourMap.get(label) ?? 0) + Number(s.total));
    }
    const hourlyData = [...hourMap.entries()].map(([time, sales]) => ({ time, sales })).slice(6, 22); // 6am-10pm

    const allProds = products ?? [];
    const lowStockItems = allProds.filter(p => p.quantity <= p.min_quantity && p.quantity > 0);
    const outOfStock = allProds.filter(p => p.quantity === 0);
    const overStock = allProds.filter(p => p.max_quantity && p.quantity >= p.max_quantity);
    const inventoryValue = allProds.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0);
    const todayTotal = (todaySales ?? []).reduce((s, r) => s + Number(r.total), 0);
    const weekTotal = (weeklySales ?? []).reduce((s, r) => s + Number(r.total), 0);

    setStats({
      todayTotal, todayCount: (todaySales ?? []).length,
      weekTotal, weekCount: (weeklySales ?? []).length,
      inventoryValue, productCount: allProds.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStock.length,
      overStockCount: overStock.length,
      lowStockItems: lowStockItems.slice(0, 6),
      outOfStockItems: outOfStock.slice(0, 4),
      overStockItems: overStock.slice(0, 4),
      recentSales: (todaySales ?? []).slice(0, 6),
      hourlyData,
      categoryBreakdown: categoryBreakdown.slice(0, 6),
    });
    setLastRefresh(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(() => fetchStats(true), 30000);
    return () => clearInterval(timerRef.current);
  }, [fetchStats]);

  const Tip = ({ active, payload, label }: any) => active && payload?.length ? (
    <div className="d-card p-2.5 text-xs shadow-fire-sm">
      <p className="text-obsidian-400 mb-1">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color: p.color }}>{fmt.currency(p.value)}</p>)}
    </div>
  ) : null;

  return (
    <AppShell title="Live Dashboard" storeName={store?.name}>
      <div className="space-y-5">
        {/* Live header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-2 w-2 rounded-full bg-fire-500 animate-fire-pulse" />
            <span className="text-xs text-obsidian-500">Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString()}</span>
          </div>
          <button onClick={() => fetchStats(true)} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-obsidian-500 hover:text-fire-400 transition-colors">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />Refresh
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Today's Sales", value: fmt.currency(stats?.todayTotal), sub: `${stats?.todayCount ?? 0} transactions`, icon: DollarSign, glow: true },
            { label: 'Weekly Sales', value: fmt.currency(stats?.weekTotal), sub: `${stats?.weekCount ?? 0} this week`, icon: TrendingUp, glow: false },
            { label: 'Inventory Value', value: fmt.currency(stats?.inventoryValue), sub: `${stats?.productCount ?? 0} products`, icon: Package, glow: false },
            { label: 'Stock Alerts', value: String((stats?.lowStockCount ?? 0) + (stats?.outOfStockCount ?? 0)), sub: `${stats?.outOfStockCount ?? 0} out · ${stats?.lowStockCount ?? 0} low`, icon: AlertTriangle, glow: (stats?.outOfStockCount ?? 0) > 0 },
          ].map(kpi => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className={cn('d-card p-5', kpi.glow && 'shadow-fire-sm border-fire-900/50')}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-obsidian-500">{kpi.label}</p>
                  <Icon className={cn('h-4 w-4', kpi.glow ? 'text-fire-500' : 'text-obsidian-600')} />
                </div>
                <p className="mono text-2xl font-bold text-white">{loading ? '—' : kpi.value}</p>
                <p className="mt-1 text-xs text-obsidian-500">{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Hourly chart */}
          <div className="lg:col-span-2 d-card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-fire-500" />Today's Sales by Hour
            </h3>
            {loading ? <div className="h-48 animate-pulse bg-obsidian-900 rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats?.hourlyData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1a1a" opacity={0.5} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#52525e' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#52525e' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="sales" fill="#c0392b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Today by category */}
          <div className="d-card p-5">
            <h3 className="font-semibold text-white mb-4">Sales by Company/Category</h3>
            {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse bg-obsidian-900 rounded" />)}</div>
              : (stats?.categoryBreakdown ?? []).length === 0 ? <p className="text-sm text-obsidian-500">No sales yet today.</p>
              : (
                <div className="space-y-2.5">
                  {stats.categoryBreakdown.map((c: any, i: number) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <span className="text-xs text-obsidian-500 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-white truncate">{c.name}</span>
                          <span className="mono text-xs text-fire-400">{fmt.currency(c.total)}</span>
                        </div>
                        <div className="h-1.5 bg-obsidian-800 rounded-full">
                          <div className="h-full bg-fire-700 rounded-full" style={{ width: `${Math.min(100, (c.total / (stats?.todayTotal || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Stock alerts */}
          <div className="d-card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-fire-500" />
              Stock Alerts
            </h3>
            <div className="space-y-2">
              {(stats?.outOfStockItems ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-fire-950/50 border border-fire-900/30 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-white">{p.name}</p>
                    <p className="text-[10px] text-obsidian-500">{p.vendor_company ?? 'Unassigned'}</p>
                  </div>
                  <span className="d-badge bg-fire-900/50 text-fire-400 text-[10px]">OUT</span>
                </div>
              ))}
              {(stats?.lowStockItems ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-gold-950/30 border border-gold-900/20 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-white">{p.name}</p>
                    <p className="text-[10px] text-obsidian-500">{p.vendor_company ?? 'Unassigned'} · {p.quantity} left</p>
                  </div>
                  <span className="d-badge bg-gold-900/30 text-gold-400 text-[10px]">LOW</span>
                </div>
              ))}
              {(stats?.overStockItems ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-obsidian-800/50 border border-obsidian-700 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-white">{p.name}</p>
                    <p className="text-[10px] text-obsidian-500">{p.quantity} in stock</p>
                  </div>
                  <span className="d-badge bg-obsidian-700 text-obsidian-300 text-[10px]">OVER</span>
                </div>
              ))}
              {!loading && (stats?.outOfStockCount ?? 0) === 0 && (stats?.lowStockCount ?? 0) === 0 && (
                <p className="text-sm text-obsidian-500 text-center py-4">All stock levels OK 🔥</p>
              )}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="lg:col-span-2 d-card">
            <div className="border-b border-dragon-border px-5 py-3.5">
              <h3 className="font-semibold text-white">Recent Transactions</h3>
            </div>
            <div className="divide-y divide-dragon-border">
              {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-5 py-3 h-14 animate-pulse"><div className="h-3 bg-obsidian-800 rounded w-3/4" /></div>)
                : (stats?.recentSales ?? []).length === 0 ? <p className="px-5 py-8 text-center text-sm text-obsidian-500">No sales yet today.</p>
                : (stats?.recentSales ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-obsidian-900/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{s.employee_name ? `${s.employee_name}` : 'Sale'}</p>
                      <p className="text-xs text-obsidian-500">{format(new Date(s.created_at), 'h:mm a')} · {s.payment_method}</p>
                    </div>
                    <span className="mono text-sm font-bold text-fire-400">{fmt.currency(s.total)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
