'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  Brain, Package, Bell, FileText, BarChart3, Settings,
  Search, Upload, LogOut, TrendingUp, TrendingDown, ArrowRight,
  AlertTriangle, Store as StoreIcon, Plus, DollarSign,
  Users, ShoppingCart, Zap, RefreshCw, Clock
} from 'lucide-react';
import { startOfDay, subDays } from 'date-fns';

const APPS = [
  { id: 'pos',       label: 'Daily Report',  href: '/pos',        icon: BarChart3,  color: '#C0392B', bg: '#FEF2F2', desc: 'Upload Modisoft report'      },
  { id: 'invoices',  label: 'Invoices',      href: '/invoices',   icon: FileText,   color: '#DB2777', bg: '#FDF2F8', desc: 'Scan & track invoices'       },
  { id: 'inventory', label: 'Inventory',     href: '/inventory',  icon: Package,    color: '#2563EB', bg: '#EFF6FF', desc: 'Stock & movement history'    },
  { id: 'ordering',  label: 'AI Ordering',   href: '/ordering',   icon: Brain,      color: '#7C3AED', bg: '#F5F3FF', desc: '90-day smart reorders'       },
  { id: 'alerts',    label: 'Price Alerts',  href: '/alerts',     icon: Bell,       color: '#D97706', bg: '#FFFBEB', desc: 'Cost change notifications'   },
  { id: 'reports',   label: 'Reports & P&L', href: '/reports',    icon: TrendingUp, color: '#059669', bg: '#ECFDF5', desc: 'Profit, loss & trends'       },
  { id: 'employees', label: 'Employees',     href: '/employees',  icon: Users,      color: '#0891B2', bg: '#ECFEFF', desc: 'Time clock & payroll'        },
  { id: 'search',    label: 'Search',        href: '/search',     icon: Search,     color: '#EA580C', bg: '#FFF7ED', desc: 'Find anything instantly'     },
  { id: 'migration', label: 'Import Data',   href: '/migration',  icon: Upload,     color: '#6B7280', bg: '#F9FAFB', desc: 'One-time CSV import'         },
  { id: 'settings',  label: 'Settings',      href: '/settings',   icon: Settings,   color: '#374151', bg: '#F9FAFB', desc: 'Stores, staff & preferences' },
];

interface DashData {
  todaySales: number; yesterdaySales: number; shortOver: number | null;
  inventoryValue: number; lowStock: number; outOfStock: number;
  priceAlerts: number; pendingInvoices: number;
  clockedIn: number; notifications: any[];
  topDepts: { label: string; value: number }[];
  recentMovements: any[];
}

export default function HomePage() {
  const { store, stores, switchStore } = useStore();
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!store) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const sb = createClient();
      const today     = new Date().toISOString().split('T')[0];
      const yesterday = subDays(new Date(), 1).toISOString().split('T')[0];

      const [
        { data: rpt }, { data: yRpt }, { data: prods },
        { data: invPending }, { data: clocks }, { data: movements },
      ] = await Promise.all([
        sb.from('daily_close_reports').select('total_sales,short_over,dept_tax,dept_nontax,dept_cig,dept_beer_wine,dept_novelty,dept_vape,fuel_unleaded,fuel_diesel,lotto_sales,lottery_sales').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
        sb.from('daily_close_reports').select('total_sales').eq('store_id', store.id).eq('report_date', yesterday).maybeSingle(),
        sb.from('products').select('unit_cost,unit_price,quantity,min_quantity').eq('store_id', store.id).eq('is_active', true),
        sb.from('invoices').select('id').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW'),
        sb.from('time_clock').select('employee_id').eq('store_id', store.id).is('clock_out', null),
        sb.from('inventory_movements').select('product_name,type,quantity,created_at').eq('store_id', store.id).gte('created_at', startOfDay(new Date()).toISOString()).order('created_at', { ascending: false }).limit(8),
      ]);

      const ps = prods ?? [];
      const inventoryValue = ps.reduce((s, p) => s + Number(p.unit_cost) * p.quantity, 0);
      const lowStock  = ps.filter(p => p.quantity > 0 && p.quantity <= p.min_quantity).length;
      const outOfStock = ps.filter(p => p.quantity === 0).length;

      // Top departments from today's report
      const topDepts = rpt ? [
        { label: 'Tobacco/CIG',  value: Number(rpt.dept_cig ?? 0)       },
        { label: 'Beer & Wine',  value: Number(rpt.dept_beer_wine ?? 0)  },
        { label: 'Tax Items',    value: Number(rpt.dept_tax ?? 0)        },
        { label: 'Non-Tax',      value: Number(rpt.dept_nontax ?? 0)     },
        { label: 'Lotto',        value: Number(rpt.lotto_sales ?? 0)     },
        { label: 'Fuel',         value: Number(rpt.fuel_unleaded ?? 0) + Number(rpt.fuel_diesel ?? 0) },
        { label: 'Vape',         value: Number(rpt.dept_vape ?? 0)      },
      ].filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 4) : [];

      // Notifications
      let notifications: any[] = [];
      try {
        const nr = await fetch('/api/notifications');
        if (nr.ok) { const nd = await nr.json(); notifications = (nd.notifications ?? []).filter((n: any) => !n.is_read).slice(0, 8); }
      } catch {}

      // Price alerts count
      const { data: priceAlerts } = await sb.from('invoices').select('id,price_changes_count').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW').gt('price_changes_count', 0);

      setData({
        todaySales: Number(rpt?.total_sales ?? 0),
        yesterdaySales: Number(yRpt?.total_sales ?? 0),
        shortOver: rpt ? Number(rpt.short_over ?? 0) : null,
        inventoryValue, lowStock, outOfStock,
        priceAlerts: (priceAlerts ?? []).length,
        pendingInvoices: (invPending ?? []).length,
        clockedIn: (clocks ?? []).length,
        notifications,
        topDepts,
        recentMovements: movements ?? [],
      });
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [store]);

  const dismissAll = async () => {
    try {
      const ids = (data?.notifications ?? []).map(n => n.id);
      if (ids.length) await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    } catch {}
    setData(d => d ? { ...d, notifications: [] } : d);
    setShowNotifs(false);
  };

  const logout = async () => {
    try { await createClient().auth.signOut(); } catch {}
    router.push('/'); router.refresh();
  };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const vsYest   = data && data.yesterdaySales > 0 ? ((data.todaySales - data.yesterdaySales) / data.yesterdaySales * 100) : null;
  const stockAlerts = (data?.notifications ?? []).filter(n => ['out_of_stock','low_stock','critical'].includes(n.type));
  const totalAlerts = (data?.priceAlerts ?? 0) + (data?.outOfStock ?? 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="screen py-8 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-sub font-medium">{greeting}</p>
            <h1 className="text-2xl font-black text-text mt-0.5">{store?.name ?? 'RA Solution'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setRefreshing(true); load(true); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            {(data?.notifications?.length ?? 0) > 0 && (
              <button onClick={() => setShowNotifs(v => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">{data?.notifications?.length}</span>
              </button>
            )}
            <button onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notification panel */}
        {showNotifs && (data?.notifications?.length ?? 0) > 0 && (
          <div className="tile mb-5 overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-50">
              <p className="font-bold text-text text-sm">Smart Alerts</p>
              <button onClick={dismissAll} className="text-xs text-accent font-semibold">Dismiss all</button>
            </div>
            <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
              {data?.notifications?.map((n: any) => (
                <div key={n.id} className={cn('px-4 py-3', n.type === 'out_of_stock' ? 'bg-red-50' : n.type === 'low_stock' ? 'bg-amber-50' : '')}>
                  <p className="text-sm font-semibold text-text">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store switcher */}
        {Array.isArray(stores) && stores.length > 1 && (
          <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
            {stores.map((s: any) => (
              <button key={s.id} onClick={() => switchStore(s.id)}
                className={cn('flex-none flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors',
                  s.id === store?.id ? 'bg-accent text-white' : 'bg-surface border border-border text-sub hover:text-text')}>
                <StoreIcon className="h-3.5 w-3.5" />{s.name}
              </button>
            ))}
            <a href="/settings" className="flex-none flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-accent whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" />Add store
            </a>
          </div>
        )}

        {/* ── KPI Dashboard Cards ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Today's Sales — full width */}
          <Link href="/pos" className="col-span-2 tile p-5 flex items-center justify-between hover:shadow-lifted transition-shadow">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Today's Sales</p>
              <p className="num text-4xl font-black text-text">{loading ? '—' : fmt.currency(data?.todaySales ?? 0)}</p>
              {vsYest !== null && (
                <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-semibold', vsYest >= 0 ? 'text-green-600' : 'text-accent')}>
                  {vsYest >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(vsYest).toFixed(1)}% vs yesterday ({fmt.currency(data?.yesterdaySales ?? 0)})
                </div>
              )}
              {data?.shortOver !== null && (
                <p className={cn('text-xs font-semibold mt-1', (data?.shortOver ?? 0) < 0 ? 'text-accent' : 'text-green-600')}>
                  Short/Over: {(data?.shortOver ?? 0) >= 0 ? '+' : ''}{fmt.currency(data?.shortOver ?? 0)}
                </p>
              )}
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <DollarSign className="h-7 w-7 text-accent" />
            </div>
          </Link>

          {/* Inventory Value */}
          <Link href="/inventory" className="tile p-4 hover:shadow-lifted transition-shadow">
            <p className="text-xs text-muted font-medium mb-1">Inventory Value</p>
            <p className="num text-xl font-black text-text">{loading ? '—' : fmt.currency(data?.inventoryValue ?? 0)}</p>
          </Link>

          {/* Stock Alerts */}
          <Link href="/inventory" className={cn('tile p-4 hover:shadow-lifted transition-shadow border-2', (data?.outOfStock ?? 0) > 0 ? 'border-red-300 bg-red-50' : 'border-transparent')}>
            <p className="text-xs text-muted font-medium mb-1">Stock Alerts</p>
            <p className={cn('num text-xl font-black', (data?.outOfStock ?? 0) > 0 ? 'text-accent' : 'text-text')}>
              {loading ? '—' : `${data?.outOfStock ?? 0} out · ${data?.lowStock ?? 0} low`}
            </p>
          </Link>

          {/* Price Alerts */}
          <Link href="/alerts" className={cn('tile p-4 hover:shadow-lifted transition-shadow', (data?.priceAlerts ?? 0) > 0 ? 'border-2 border-amber-300 bg-amber-50' : '')}>
            <p className="text-xs text-muted font-medium mb-1">Price Changes</p>
            <p className={cn('num text-xl font-black', (data?.priceAlerts ?? 0) > 0 ? 'text-amber-700' : 'text-text')}>
              {loading ? '—' : `${data?.priceAlerts ?? 0} pending`}
            </p>
          </Link>

          {/* Pending Invoices */}
          <Link href="/invoices" className="tile p-4 hover:shadow-lifted transition-shadow">
            <p className="text-xs text-muted font-medium mb-1">Pending Invoices</p>
            <p className="num text-xl font-black text-text">{loading ? '—' : data?.pendingInvoices ?? 0}</p>
          </Link>

          {/* Clocked In */}
          <Link href="/employees" className="tile p-4 hover:shadow-lifted transition-shadow">
            <p className="text-xs text-muted font-medium mb-1">Staff Clocked In</p>
            <p className="num text-xl font-black text-text">{loading ? '—' : data?.clockedIn ?? 0}</p>
          </Link>
        </div>

        {/* Top departments today */}
        {(data?.topDepts?.length ?? 0) > 0 && (
          <div className="tile p-5 mb-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Top Departments Today</p>
            <div className="space-y-2">
              {data?.topDepts?.map(dept => {
                const pct = data.todaySales > 0 ? (dept.value / data.todaySales * 100) : 0;
                return (
                  <div key={dept.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-text">{dept.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                        <span className="num text-sm font-bold text-text">{fmt.currency(dept.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%`, opacity: 0.6 + pct / 100 * 0.4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {!loading && data && (
          <div className="tile p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-violet-600" />
              <p className="font-bold text-text">AI Recommendations</p>
            </div>
            <div className="space-y-2">
              {data.outOfStock > 0 && (
                <Link href="/inventory" className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 hover:bg-red-100 transition-colors">
                  <span className="text-base shrink-0">🚨</span>
                  <p className="text-sm font-medium text-red-800">{data.outOfStock} products are out of stock — check inventory and reorder</p>
                  <ArrowRight className="h-4 w-4 text-red-400 shrink-0 mt-0.5 ml-auto" />
                </Link>
              )}
              {data.lowStock > 3 && (
                <Link href="/ordering" className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 hover:bg-amber-100 transition-colors">
                  <span className="text-base shrink-0">⚠️</span>
                  <p className="text-sm font-medium text-amber-800">{data.lowStock} products running low — generate AI orders now</p>
                  <ArrowRight className="h-4 w-4 text-amber-400 shrink-0 mt-0.5 ml-auto" />
                </Link>
              )}
              {data.priceAlerts > 0 && (
                <Link href="/alerts" className="flex items-start gap-3 rounded-xl bg-purple-50 border border-purple-200 px-4 py-3 hover:bg-purple-100 transition-colors">
                  <span className="text-base shrink-0">💰</span>
                  <p className="text-sm font-medium text-purple-800">{data.priceAlerts} invoices have price changes — review and update retail prices</p>
                  <ArrowRight className="h-4 w-4 text-purple-400 shrink-0 mt-0.5 ml-auto" />
                </Link>
              )}
              {data.pendingInvoices > 0 && (
                <Link href="/invoices" className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 hover:bg-blue-100 transition-colors">
                  <span className="text-base shrink-0">📋</span>
                  <p className="text-sm font-medium text-blue-800">{data.pendingInvoices} invoices need review — apply to update inventory costs</p>
                  <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 ml-auto" />
                </Link>
              )}
              {data.outOfStock === 0 && data.lowStock <= 3 && data.priceAlerts === 0 && data.pendingInvoices === 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <span className="text-base">✅</span>
                  <p className="text-sm font-medium text-green-800">Everything looks good — store is running smoothly</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* App grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {APPS.map(app => {
            const Icon = app.icon;
            const badge = app.id === 'alerts' ? (data?.priceAlerts ?? 0) : app.id === 'inventory' ? (data?.outOfStock ?? 0) + (data?.lowStock ?? 0) : app.id === 'invoices' ? (data?.pendingInvoices ?? 0) : 0;
            return (
              <Link key={app.id} href={app.href}
                className="tile tile-hover p-4 flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: app.bg }}>
                    <Icon className="h-5 w-5" style={{ color: app.color }} />
                  </div>
                  {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1">{badge}</span>}
                </div>
                <div>
                  <p className="text-sm font-bold text-text leading-tight">{app.label}</p>
                  <p className="text-xs text-muted mt-0.5">{app.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Recent inventory movements */}
        {(data?.recentMovements?.length ?? 0) > 0 && (
          <div className="tile overflow-hidden">
            <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
              <p className="font-bold text-text text-sm">Today's Inventory Activity</p>
              <Link href="/inventory" className="text-xs text-accent font-semibold">View all</Link>
            </div>
            <div className="divide-y divide-border/60">
              {data?.recentMovements?.map((mv: any) => (
                <div key={mv.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{mv.product_name}</p>
                    <p className="text-xs text-muted capitalize">{mv.type} · {mv.reference_label ?? '—'}</p>
                  </div>
                  <span className={cn('num text-sm font-bold', Number(mv.quantity) > 0 ? 'text-green-600' : 'text-accent')}>
                    {Number(mv.quantity) > 0 ? '+' : ''}{mv.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
