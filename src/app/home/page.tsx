'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  ShoppingCart, Brain, Package, Bell, FileText, BarChart3,
  Settings, Search, Upload, LogOut, TrendingUp, ArrowRight,
  AlertTriangle, Store as StoreIcon, Plus
} from 'lucide-react';
import { startOfDay } from 'date-fns';

const APPS = [
  { id: 'pos',       label: 'Daily Sales',  href: '/pos',       icon: ShoppingCart, color: '#16A34A', bg: '#F0FDF4', desc: 'POS, close till & report' },
  { id: 'ordering',  label: 'AI Ordering',  href: '/ordering',  icon: Brain,        color: '#7C3AED', bg: '#F5F3FF', desc: 'Smart reorders'            },
  { id: 'inventory', label: 'Inventory',    href: '/inventory', icon: Package,      color: '#2563EB', bg: '#EFF6FF', desc: 'Stock & products'           },
  { id: 'alerts',    label: 'Price Alerts', href: '/alerts',    icon: Bell,         color: '#D97706', bg: '#FFFBEB', desc: 'Cost changes'               },
  { id: 'invoices',  label: 'Invoices',     href: '/invoices',  icon: FileText,     color: '#DB2777', bg: '#FDF2F8', desc: 'Upload & track'             },
  { id: 'reports',   label: 'Reports',      href: '/reports',   icon: BarChart3,    color: '#059669', bg: '#ECFDF5', desc: 'Daily hisab'                },
  { id: 'search',    label: 'Search',       href: '/search',    icon: Search,       color: '#EA580C', bg: '#FFF7ED', desc: 'Find anything'              },
  { id: 'migration', label: 'Import Data',  href: '/migration', icon: Upload,       color: '#6B7280', bg: '#F9FAFB', desc: 'CSV import'                 },
  { id: 'settings',  label: 'Settings',     href: '/settings',  icon: Settings,     color: '#374151', bg: '#F9FAFB', desc: 'Store info & employees'     },
];

export default function HomePage() {
  const { store, stores, switchStore } = useStore();
  const router = useRouter();
  const [todaySales, setTodaySales]     = useState<number | null>(null);
  const [txns, setTxns]                 = useState(0);
  const [priceAlerts, setPriceAlerts]   = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [shortOver, setShortOver]       = useState<number | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;

    const load = async () => {
      try {
        const sb = createClient();
        const todayStart = startOfDay(new Date()).toISOString();
        const today      = new Date().toISOString().split('T')[0];

        const [salesRes, invRes, rptRes] = await Promise.all([
          sb.from('sales').select('total').eq('store_id', store.id).gte('created_at', todayStart),
          sb.from('invoices').select('id').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW'),
          sb.from('daily_close_reports').select('short_over').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
        ]);

        if (cancelled) return;

        setTodaySales((salesRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0));
        setTxns((salesRes.data ?? []).length);
        setPriceAlerts((invRes.data ?? []).length);
        if (rptRes.data) setShortOver(Number(rptRes.data.short_over));
      } catch (err) {
        console.error('home load error:', err);
      }

      // Notifications — separate try so it never blocks the page
      try {
        const res  = await fetch('/api/notifications');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setNotifications((data.notifications ?? []).filter((n: any) => !n.is_read).slice(0, 10));
        }
      } catch { /* silently ignore */ }
    };

    load();
    return () => { cancelled = true; };
  }, [store]);

  const dismissAll = async () => {
    try {
      const ids = notifications.map((n: any) => n.id);
      if (ids.length > 0) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      }
    } catch { /* ignore */ }
    setNotifications([]);
    setShowNotifs(false);
  };

  const logout = async () => {
    try { await createClient().auth.signOut(); } catch { /* ignore */ }
    router.push('/');
    router.refresh();
  };

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const outOfStock  = notifications.filter((n: any) => n.type === 'out_of_stock');
  const stockAlerts = notifications.filter((n: any) => ['out_of_stock', 'low_stock', 'critical'].includes(n.type));
  const totalAlerts = priceAlerts + outOfStock.length;

  return (
    <div className="min-h-screen bg-white">
      <div className="screen py-8 pb-20">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-sub font-medium">{greeting}</p>
            <h1 className="text-2xl font-black text-text mt-0.5">
              {store?.name ?? 'RA Solution'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub hover:bg-surface transition-colors">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                  {notifications.length}
                </span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub hover:bg-surface transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Notification panel ── */}
        {showNotifs && notifications.length > 0 && (
          <div className="tile mb-5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gray-50">
              <p className="font-bold text-text text-sm">Smart Alerts</p>
              <button onClick={dismissAll} className="text-xs text-accent font-semibold">
                Dismiss all
              </button>
            </div>
            <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
              {notifications.map((n: any) => (
                <div key={n.id} className={cn('px-4 py-3',
                  n.type === 'out_of_stock' ? 'bg-red-50' :
                  n.type === 'low_stock'    ? 'bg-amber-50' : '')}>
                  <p className="text-sm font-semibold text-text">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Store switcher (only when multiple stores) ── */}
        {Array.isArray(stores) && stores.length > 1 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            {stores.map((s: any) => (
              <button key={s.id} onClick={() => switchStore(s.id)}
                className={cn(
                  'flex-none flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap',
                  s.id === store?.id
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-border text-sub hover:text-text'
                )}>
                <StoreIcon className="h-3.5 w-3.5" />
                {s.name}
              </button>
            ))}
            <a href="/settings"
              className="flex-none flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-2 text-xs text-muted hover:border-accent hover:text-accent transition-colors whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" />Add store
            </a>
          </div>
        )}

        {/* ── Today summary ── */}
        {todaySales !== null && (
          <div className="tile p-5 mb-6 flex items-center justify-between border-l-4 border-l-accent">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Today's Sales</p>
              <p className="num text-3xl font-black text-text">{fmt.currency(todaySales)}</p>
              <p className="text-xs text-sub mt-1">{txns} transaction{txns !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {shortOver !== null && (
                <div className={cn('chip font-semibold text-xs',
                  shortOver === 0 ? 'chip-green' : shortOver < 0 ? 'chip-red' : 'chip-green')}>
                  {shortOver >= 0 ? '+' : ''}{fmt.currency(shortOver)} short/over
                </div>
              )}
              {totalAlerts > 0 && (
                <Link href="/alerts" className="chip bg-red-100 text-accent font-semibold text-xs">
                  <Bell className="h-3 w-3" />{totalAlerts} alert{totalAlerts > 1 ? 's' : ''}
                </Link>
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
            </div>
          </div>
        )}

        {/* ── Out of stock banner ── */}
        {outOfStock.length > 0 && (
          <Link href="/inventory"
            className="tile mb-5 p-4 flex items-center gap-3 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-accent">{outOfStock.length} product{outOfStock.length > 1 ? 's' : ''} out of stock</p>
              <p className="text-xs text-red-600">Tap to view inventory and reorder</p>
            </div>
            <ArrowRight className="h-4 w-4 text-accent shrink-0" />
          </Link>
        )}

        {/* ── App icon grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {APPS.map(app => {
            const Icon = app.icon;
            const badge =
              app.id === 'alerts'    ? priceAlerts :
              app.id === 'inventory' ? stockAlerts.length :
              0;
            return (
              <Link key={app.id} href={app.href}
                className="tile tile-hover p-5 flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ background: app.bg }}>
                    <Icon className="h-6 w-6" style={{ color: app.color }} />
                  </div>
                  {badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1">
                      {badge}
                    </span>
                  )}
                  {app.id === 'pos' && todaySales !== null && todaySales > 0 && badge === 0 && (
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-text leading-tight">{app.label}</p>
                  <p className="text-xs text-muted mt-0.5">{app.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Quick actions ── */}
        <div>
          <p className="section-title">Quick actions</p>
          <div className="tile overflow-hidden divide-y divide-border">
            {[
              { label: 'Submit Close Till',    desc: 'Upload or scan your close sheet',    href: '/pos',       color: '#16A34A', bg: '#F0FDF4', Icon: ShoppingCart },
              { label: 'Upload Invoice',        desc: 'AI reads and updates inventory',     href: '/invoices',  color: '#DB2777', bg: '#FDF2F8', Icon: Upload       },
              { label: 'Generate AI Order',     desc: 'Restock from any vendor',            href: '/ordering',  color: '#7C3AED', bg: '#F5F3FF', Icon: Brain        },
              { label: 'Check Stock Alerts',    desc: `${stockAlerts.length} items need attention`, href: '/inventory', color: '#2563EB', bg: '#EFF6FF', Icon: Package },
            ].map(q => (
              <Link key={q.label} href={q.href} className="list-row hover:bg-surface">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: q.bg }}>
                    <q.Icon className="h-4 w-4" style={{ color: q.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{q.label}</p>
                    <p className="text-xs text-muted">{q.desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-dim" />
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-dim">RA Solution · {store?.name ?? ''}</p>
      </div>
    </div>
  );
}
