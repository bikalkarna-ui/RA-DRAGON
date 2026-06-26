'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/utils';
import { ShoppingCart, Brain, Package, Bell, FileText, BarChart3, Settings, Search, Upload, LogOut, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { startOfDay } from 'date-fns';

const APPS = [
  { id: 'pos',       label: 'Live Sales',    href: '/pos',       icon: ShoppingCart, color: '#16A34A', bg: '#F0FDF4', desc: 'POS & register' },
  { id: 'ordering',  label: 'AI Ordering',   href: '/ordering',  icon: Brain,        color: '#7C3AED', bg: '#F5F3FF', desc: 'Smart reorders' },
  { id: 'inventory', label: 'Inventory',     href: '/inventory', icon: Package,      color: '#2563EB', bg: '#EFF6FF', desc: 'Stock & products' },
  { id: 'alerts',    label: 'Price Alerts',  href: '/alerts',    icon: Bell,         color: '#D97706', bg: '#FFFBEB', desc: 'Cost changes' },
  { id: 'invoices',  label: 'Invoices',      href: '/invoices',  icon: FileText,     color: '#DB2777', bg: '#FDF2F8', desc: 'Upload & track' },
  { id: 'reports',   label: 'Reports',       href: '/reports',   icon: BarChart3,    color: '#059669', bg: '#ECFDF5', desc: 'Daily hisab' },
  { id: 'search',    label: 'Search',        href: '/search',    icon: Search,       color: '#EA580C', bg: '#FFF7ED', desc: 'Find anything' },
  { id: 'migration', label: 'Import Data',   href: '/migration', icon: Upload,       color: '#6B7280', bg: '#F9FAFB', desc: 'CSV import' },
  { id: 'settings',  label: 'Settings',      href: '/settings',  icon: Settings,     color: '#374151', bg: '#F9FAFB', desc: 'Store info' },
];

export default function HomePage() {
  const { store } = useStore();
  const router = useRouter();
  const [todaySales, setTodaySales] = useState<number | null>(null);
  const [txns, setTxns] = useState(0);
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    if (!store) return;
    const load = async () => {
      const sb = createClient();
      const todayStart = startOfDay(new Date()).toISOString();
      const [{ data: sales }, { data: inv }] = await Promise.all([
        sb.from('sales').select('total').eq('store_id', store.id).gte('created_at', todayStart),
        sb.from('invoices').select('id').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW'),
      ]);
      setTodaySales((sales ?? []).reduce((s, r) => s + Number(r.total), 0));
      setTxns((sales ?? []).length);
      setAlerts((inv ?? []).length);
    };
    load();
  }, [store]);

  const logout = async () => { await createClient().auth.signOut(); router.push('/'); router.refresh(); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-white">
      <div className="screen py-8 pb-20">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm text-sub font-medium">{greeting}</p>
            <h1 className="text-2xl font-black text-text mt-0.5 leading-tight">{store?.name ?? 'RA Solution'}</h1>
          </div>
          <button onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub hover:bg-surface transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Today summary */}
        {todaySales !== null && (
          <div className="tile p-5 mb-7 flex items-center justify-between animate-fade-up border-l-4 border-l-accent">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Today's Sales</p>
              <p className="num text-3xl font-black text-text">{fmt.currency(todaySales)}</p>
              <p className="text-xs text-sub mt-1">{txns} transaction{txns !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {alerts > 0 && (
                <Link href="/alerts" className="chip-red font-semibold text-xs">
                  <Bell className="h-3 w-3" />{alerts} alert{alerts > 1 ? 's' : ''}
                </Link>
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
            </div>
          </div>
        )}

        {/* App icon grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {APPS.map(app => {
            const Icon = app.icon;
            return (
              <Link key={app.id} href={app.href}
                className="tile tile-hover p-5 flex flex-col gap-3 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: app.bg }}>
                    <Icon className="h-6 w-6" style={{ color: app.color }} />
                  </div>
                  {app.id === 'alerts' && alerts > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1">
                      {alerts}
                    </span>
                  )}
                  {app.id === 'pos' && todaySales !== null && todaySales > 0 && (
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

        {/* Quick actions */}
        <div>
          <p className="section-title">Quick actions</p>
          <div className="tile overflow-hidden divide-y divide-border">
            {[
              { label: 'Quick Sale', desc: 'Open register', href: '/pos', color: '#16A34A', bg: '#F0FDF4', Icon: Zap },
              { label: 'Upload Invoice', desc: 'AI reads and processes it', href: '/invoices', color: '#DB2777', bg: '#FDF2F8', Icon: Upload },
              { label: 'Generate AI Order', desc: 'Restock from any vendor', href: '/ordering', color: '#7C3AED', bg: '#F5F3FF', Icon: Brain },
            ].map(q => (
              <Link key={q.label} href={q.href} className="list-row hover:bg-surface">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: q.bg }}>
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
      </div>
    </div>
  );
}
