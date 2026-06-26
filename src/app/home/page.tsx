'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/utils';
import {
  ShoppingCart, Brain, Package, Bell, FileText,
  BarChart3, Settings, Search, Upload, LogOut,
  TrendingUp, AlertTriangle, Zap
} from 'lucide-react';
import { startOfDay } from 'date-fns';

const APPS = [
  { id: 'pos',       label: 'Live Sales',      href: '/pos',       icon: ShoppingCart, color: '#22C55E', desc: 'POS & today\'s activity' },
  { id: 'ordering',  label: 'AI Ordering',     href: '/ordering',  icon: Brain,        color: '#A78BFA', desc: 'Smart order generation' },
  { id: 'inventory', label: 'Inventory',       href: '/inventory', icon: Package,      color: '#60A5FA', desc: 'Stock & product catalog' },
  { id: 'alerts',    label: 'Price Alerts',    href: '/alerts',    icon: Bell,         color: '#FBBF24', desc: 'Cost change notifications' },
  { id: 'invoices',  label: 'Invoices',        href: '/invoices',  icon: FileText,     color: '#F472B6', desc: 'Upload & track invoices' },
  { id: 'reports',   label: 'Reports',         href: '/reports',   icon: BarChart3,    color: '#34D399', desc: 'Daily & monthly hisab' },
  { id: 'search',    label: 'Search',          href: '/search',    icon: Search,       color: '#FB923C', desc: 'Find anything instantly' },
  { id: 'migration', label: 'Import Data',     href: '/migration', icon: Upload,       color: '#94A3B8', desc: 'CSV & Excel import' },
  { id: 'settings',  label: 'Settings',        href: '/settings',  icon: Settings,     color: '#6B7280', desc: 'Store & preferences' },
];

export default function HomePage() {
  const { store } = useStore();
  const router = useRouter();
  const [todaySales, setTodaySales] = useState<number | null>(null);
  const [alerts, setAlerts] = useState(0);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

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
      setAlerts((inv ?? []).length);
    };
    load();
  }, [store]);

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const hour = time.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-bg">
      <div className="screen py-8 pb-16">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sub text-sm font-medium">{greeting}</p>
            <h1 className="text-2xl font-bold text-text mt-0.5 leading-tight">
              {store?.name ?? 'RA Solution'}
            </h1>
          </div>
          <button onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted hover:text-sub transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Today's summary strip */}
        {todaySales !== null && (
          <div className="tile p-5 mb-8 flex items-center justify-between animate-fade-up">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">Today's Sales</p>
              <p className="num text-3xl font-bold text-text mt-1">{fmt.currency(todaySales)}</p>
            </div>
            <div className="flex items-center gap-3">
              {alerts > 0 && (
                <Link href="/alerts" className="flex items-center gap-1.5 chip-yellow">
                  <Bell className="h-3.5 w-3.5" />
                  {alerts} alert{alerts > 1 ? 's' : ''}
                </Link>
              )}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
            </div>
          </div>
        )}

        {/* App grid — the iPhone home screen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {APPS.map((app, i) => {
            const Icon = app.icon;
            return (
              <Link key={app.id} href={app.href}
                className="tile tile-hover p-5 flex flex-col gap-4 cursor-pointer"
                style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${app.color}18` }}>
                    <Icon className="h-7 w-7" style={{ color: app.color }} />
                  </div>
                  {app.id === 'alerts' && alerts > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                      {alerts}
                    </span>
                  )}
                  {app.id === 'pos' && todaySales !== null && todaySales > 0 && (
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-text leading-tight">{app.label}</p>
                  <p className="text-xs text-muted mt-0.5 leading-snug">{app.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick actions row */}
        <div className="mt-8">
          <p className="section-title">Quick actions</p>
          <div className="tile overflow-hidden divide-y divide-border/60">
            <Link href="/pos" className="list-row">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/10">
                  <Zap className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-sm font-medium text-text">Quick Sale</span>
              </div>
              <span className="text-muted text-xs">→</span>
            </Link>
            <Link href="/invoices" className="list-row">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10">
                  <Upload className="h-4 w-4 text-pink-400" />
                </div>
                <span className="text-sm font-medium text-text">Upload Invoice</span>
              </div>
              <span className="text-muted text-xs">→</span>
            </Link>
            <Link href="/ordering" className="list-row">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                  <Brain className="h-4 w-4 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-text">Generate AI Order</span>
              </div>
              <span className="text-muted text-xs">→</span>
            </Link>
          </div>
        </div>

        {/* Version */}
        <p className="mt-10 text-center text-xs text-dim">RA Solution v3 · {time.toLocaleDateString()}</p>
      </div>
    </div>
  );
}
