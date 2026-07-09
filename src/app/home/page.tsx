'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  BarChart3, Package, Brain, Bell, FileText, TrendingUp, TrendingDown,
  Users, LogOut, RefreshCw, Zap, AlertTriangle, DollarSign, X, Send,
  Fuel, Receipt, PieChart, Shield, Building2, Clock, Download,
  ChevronRight, Settings
} from 'lucide-react';

// ── AI Copilot ──────────────────────────────────────────────────────────────
function AICopilot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: "Hi! Ask me anything about your store — sales, inventory, deposits, short/over, employees, or anything else." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const SUGGESTIONS = ["Deposit amount today?", "What's running low?", "This week's sales?", "Today's short/over"];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const send = async (text?: string) => {
    const msg = (text || input).trim(); if (!msg || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next); setLoading(true);
    try {
      const res = await fetch('/api/ai-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: messages }) });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }]);
    } catch { setMessages([...next, { role: 'assistant', content: 'Connection error.' }]); }
    setLoading(false); setTimeout(() => inputRef.current?.focus(), 50);
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl border-t border-gray-200" style={{ height: '72vh', maxWidth: 680, margin: '0 auto' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-gray-300" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent"><Zap className="h-4 w-4 text-white" /></div>
            <div><p className="font-black text-text text-sm leading-tight">RYXSOR AI AI</p><div className="flex items-center gap-1.5 mt-0.5"><div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /><p className="text-[10px] text-muted font-medium">Knows your store</p></div></div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5"><Zap className="h-3.5 w-3.5 text-white" /></div>}
              <div className={cn('max-w-[80%] px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'bg-accent text-white rounded-2xl rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md')}>{m.content}</div>
            </div>
          ))}
          {loading && <div className="flex items-end gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5"><Zap className="h-3.5 w-3.5 text-white" /></div><div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">{[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div></div>}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)} className="flex-none text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full px-4 py-2 transition-colors whitespace-nowrap">{s}</button>)}
          </div>
        )}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything…" autoFocus className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm focus:outline-none" />
            <button onClick={() => send()} disabled={!input.trim() || loading} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all', input.trim() && !loading ? 'bg-accent text-white' : 'bg-gray-300 text-gray-400')}><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { store, storeData } = useStore();
  const router = useRouter();
  const [showAI, setShowAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [kpis, setKpis] = useState({
    grossSales: 0, shortOver: 0, outOfStock: 0, lowStock: 0,
    staffIn: 0, pendingInv: 0, invValue: 0, weekSales: 0,
    fuelSales: 0, monthSales: 0, hasReport: false,
  });

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    try {
      const sb = createClient();
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now()-30*86400000).toISOString().split('T')[0];

      const [{ data: dr }, { data: products }, { data: active }, { data: invs }, { data: weekRpts }, { data: monthRpts }] = await Promise.all([
        sb.from('daily_reports').select('gross_sales,drawer_difference,fuel_sales,status').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
        sb.from('products').select('quantity,min_quantity,unit_cost').eq('store_id', store.id).eq('is_active', true),
        sb.from('time_clock').select('id').eq('store_id', store.id).is('clock_out', null),
        sb.from('invoices').select('id').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW'),
        sb.from('daily_reports').select('gross_sales').eq('store_id', store.id).gte('report_date', weekAgo),
        sb.from('daily_reports').select('gross_sales').eq('store_id', store.id).gte('report_date', monthAgo),
      ]);

      const n = (v: any) => Number(v || 0);
      const prods = products || [];
      setKpis({
        grossSales: n(dr?.gross_sales),
        shortOver: n(dr?.drawer_difference),
        outOfStock: prods.filter(p => p.quantity === 0).length,
        lowStock: prods.filter(p => p.quantity > 0 && p.quantity <= p.min_quantity).length,
        staffIn: active?.length || 0,
        pendingInv: invs?.length || 0,
        invValue: prods.reduce((s, p) => s + n(p.unit_cost) * n(p.quantity), 0),
        weekSales: (weekRpts||[]).reduce((s, r) => s + n(r.gross_sales), 0),
        monthSales: (monthRpts||[]).reduce((s, r) => s + n(r.gross_sales), 0),
        fuelSales: n(dr?.fuel_sales),
        hasReport: !!dr,
      });
    } catch (e) { console.error(e); }
    setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  // Check push notification status
  useEffect(() => {
    if (mounted && 'Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted');
    }
  }, [mounted]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotifEnabled(true);
      // Register push subscription
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        // Show test notification
        reg.showNotification('RYXSOR AI', {
          body: 'Notifications enabled! You\'ll get daily store summaries.',
          icon: '/icon-192.png',
        });
      }
    }
  };

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
  };

  if (!mounted) return null;

  const { grossSales, shortOver, outOfStock, lowStock, staffIn, pendingInv, invValue, weekSales, monthSales, fuelSales, hasReport } = kpis;
  const isShort = shortOver < -0.50;
  const isOver  = shortOver > 0.50;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const storeName = storeData?.name || 'Your Store';

  const healthScore = Math.max(0, Math.min(100, 80
    - (outOfStock * 5)
    - (lowStock * 2)
    - (pendingInv * 3)
    - (isShort ? 15 : 0)
    + (hasReport ? 10 : -10)
  ));

  const APPS = [
    { href: '/cashier',     icon: DollarSign, label: 'Cashier Actions', sub: 'Drop · Paid out · Vendor', badge: 0, color: 'bg-green-50 text-green-700' },
    { href: '/pos',         icon: BarChart3,  label: 'Daily Reports',    sub: 'Upload & review',    badge: 0,          color: 'bg-red-50 text-accent' },
    { href: '/invoices',    icon: FileText,   label: 'Invoices',         sub: 'Scan vendor invoices', badge: pendingInv, color: 'bg-pink-50 text-pink-600' },
    { href: '/inventory',   icon: Package,    label: 'Inventory',        sub: 'Stock & movement',   badge: outOfStock,  color: 'bg-blue-50 text-blue-600' },
    { href: '/ordering',    icon: Brain,      label: 'AI Ordering',      sub: '90-day reorders',    badge: 0,           color: 'bg-violet-50 text-violet-600' },
    { href: '/alerts',      icon: Bell,       label: 'Alerts',           sub: 'Price & stock',      badge: 0,           color: 'bg-amber-50 text-amber-600' },
    { href: '/reports',     icon: TrendingUp, label: 'Reports & P&L',    sub: 'Trends & analytics', badge: 0,           color: 'bg-green-50 text-green-600' },
    { href: '/employees',   icon: Users,      label: 'Employees',        sub: 'Time clock & pay',   badge: staffIn,     color: 'bg-cyan-50 text-cyan-600' },
    { href: '/fuel',        icon: Fuel,       label: 'Fuel Margins',     sub: 'Cost vs price',      badge: 0,           color: 'bg-orange-50 text-orange-600' },
    { href: '/shrink',      icon: AlertTriangle, label: 'Shrink & Waste',sub: 'Loss tracking',      badge: 0,           color: 'bg-red-50 text-red-500' },
    { href: '/performance', icon: Users,      label: 'Performance',      sub: 'Employee stats',     badge: 0,           color: 'bg-indigo-50 text-indigo-600' },
    { href: '/trends',      icon: TrendingUp, label: 'Annual Trends',    sub: 'Year over year',     badge: 0,           color: 'bg-teal-50 text-teal-600' },
    { href: '/tax',         icon: Receipt,    label: 'Tax Reports',      sub: 'Quarterly filing',   badge: 0,           color: 'bg-emerald-50 text-emerald-600' },
    { href: '/deposit',     icon: DollarSign, label: 'Deposit Slip',     sub: 'Auto-generate',      badge: 0,           color: 'bg-green-50 text-green-700' },
    { href: '/bank',        icon: Building2,  label: 'Bank Recon',       sub: 'Match deposits',     badge: 0,           color: 'bg-blue-50 text-blue-700' },
    { href: '/vendors',     icon: Shield,     label: 'Vendors',          sub: 'Price tracking',     badge: 0,           color: 'bg-gray-50 text-gray-600' },
    { href: '/search',      icon: Brain,      label: 'Search',           sub: 'Find anything',      badge: 0,           color: 'bg-gray-50 text-gray-600' },
    { href: '/migration',   icon: Download,   label: 'Import Data',      sub: 'CSV import',         badge: 0,           color: 'bg-gray-50 text-gray-500' },
    { href: '/settings',    icon: Settings,   label: 'Settings',         sub: 'Store & connector',  badge: 0,           color: 'bg-gray-50 text-gray-500' },
  ];

  const OPS_NAV = [
    { href: '/cashier',   icon: DollarSign, label: 'Cashier Actions', badge: 0 },
    { href: '/invoices',  icon: FileText,   label: 'Invoices',        badge: pendingInv },
    { href: '/inventory', icon: Package,    label: 'Inventory',       badge: outOfStock },
    { href: '/ordering',  icon: Brain,      label: 'AI Ordering',     badge: 0 },
    { href: '/reports',   icon: TrendingUp, label: 'Reports & P&L',   badge: 0 },
    { href: '/employees', icon: Users,      label: 'Employees',       badge: staffIn },
    { href: '/vendors',   icon: Shield,     label: 'Vendors',         badge: 0 },
  ];
  const MGMT_NAV = [
    { href: '/alerts',    icon: Bell,          label: 'Alerts' },
    { href: '/shrink',    icon: AlertTriangle, label: 'Shrink & Waste' },
    { href: '/fuel',      icon: Fuel,          label: 'Fuel Margins' },
    { href: '/performance', icon: Users,       label: 'Performance' },
    { href: '/trends',    icon: TrendingUp,    label: 'Annual Trends' },
    { href: '/tax',       icon: Receipt,       label: 'Tax Reports' },
    { href: '/deposit',   icon: DollarSign,    label: 'Deposit Slip' },
    { href: '/bank',      icon: Building2,     label: 'Bank Recon' },
    { href: '/search',    icon: Brain,         label: 'Search' },
    { href: '/migration', icon: Download,      label: 'Import Data' },
    { href: '/settings',  icon: Settings,      label: 'Settings' },
  ];

  return (
    <div className="md:flex md:min-h-screen">
      {/* Desktop sidebar — hidden on phone, shown on tablet/desktop widths */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-white md:shrink-0">
        <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white font-black text-sm">RX</div>
          <div className="min-w-0">
            <p className="font-black text-text text-sm leading-tight truncate">{storeName}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Operations</p>
            <div className="space-y-0.5">
              {OPS_NAV.map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-semibold text-sub hover:bg-surface hover:text-text transition-colors">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-black px-1">{item.badge}</span>}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Management</p>
            <div className="space-y-0.5">
              {MGMT_NAV.map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-semibold text-sub hover:bg-surface hover:text-text transition-colors">
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-border flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold text-xs shrink-0">
            {storeName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text truncate">{storeName}</p>
            <p className="text-[11px] text-muted truncate">Store Dashboard</p>
          </div>
          <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-sub shrink-0">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main content — unchanged on mobile, becomes the right panel on desktop */}
      <div className="flex-1 pb-24 md:pb-8">
      <div className="px-4 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{greeting}</p>
          <h1 className="font-black text-2xl text-text leading-tight md:hidden">{storeName}</h1>
          <h1 className="hidden md:block font-black text-2xl text-text leading-tight">Welcome back!</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setRefreshing(true); load(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setShowAI(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-lg relative">
            <Zap className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-green-400 border border-white" />
          </button>
          <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub md:hidden">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Store Health */}
        <div className="tile p-4 flex items-center gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black text-xl text-white',
            healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500')}>
            {healthScore}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text leading-tight">
              {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
            </p>
            <p className="text-xs text-muted mt-0.5">Store Health</p>
          </div>
        </div>

        {/* Push notification prompt */}
        {!notifEnabled && (
          <button onClick={enableNotifications} className="w-full rounded-2xl bg-violet-50 border border-violet-200 p-4 flex items-center gap-3 text-left">
            <Bell className="h-5 w-5 text-violet-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-violet-800">Enable notifications</p>
              <p className="text-xs text-violet-600">Get daily store summary at closing time</p>
            </div>
            <ChevronRight className="h-4 w-4 text-violet-400" />
          </button>
        )}

        {/* App grid */}
        <div>
          <p className="section-title">Quick Access</p>
          <div className="grid grid-cols-2 gap-3">
            {APPS.map(app => (
              <Link key={app.href} href={app.href}
                className="tile p-4 flex items-center gap-3 hover:bg-surface transition-colors active:scale-95 relative overflow-hidden">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', app.color)}>
                  <app.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text leading-tight">{app.label}</p>
                  <p className="text-xs text-muted mt-0.5 leading-tight">{app.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                {app.badge > 0 && (
                  <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-black px-1">
                    {app.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
      </div>

      {showAI && <AICopilot onClose={() => setShowAI(false)} />}
    </div>
  );
}
