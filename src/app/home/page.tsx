'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  BarChart3, Package, Brain, Bell, FileText, TrendingUp, TrendingDown,
  Users, LogOut, RefreshCw, Zap, AlertTriangle, DollarSign, X, Send,
  Fuel, Receipt, PieChart, Shield, Building2, Clock, Download,
  ChevronRight, Settings, Mail
} from 'lucide-react';

// Lightweight formatter — converts any stray **bold** markdown into real
// bold text and preserves line breaks, so chat never shows raw asterisks
// even if the model slips despite being told not to use markdown.
function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <div key={i} className={i > 0 ? 'mt-1' : ''}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
                : <span key={j}>{part}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── AI Copilot ──────────────────────────────────────────────────────────────
function AICopilot({ onClose, storeId }: { onClose: () => void; storeId?: string }) {
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
      const res = await fetch('/api/ai-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: messages, store_id: storeId }) });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }]);
    } catch { setMessages([...next, { role: 'assistant', content: 'Connection error.' }]); }
    setLoading(false); setTimeout(() => inputRef.current?.focus(), 50);
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl border-t border-white/10" style={{ height: '72vh', maxWidth: 680, margin: '0 auto' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-gray-300" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent"><Zap className="h-4 w-4 text-white" /></div>
            <div><p className="font-black text-text text-sm leading-tight">RYXSOR AI</p><div className="flex items-center gap-1.5 mt-0.5"><div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /><p className="text-[10px] text-muted font-medium">Knows your store</p></div></div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-500 hover:bg-gray-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5"><Zap className="h-3.5 w-3.5 text-white" /></div>}
              <div className={cn('max-w-[80%] px-4 py-3 text-sm leading-relaxed', m.role === 'user' ? 'bg-accent text-white rounded-2xl rounded-br-md' : 'bg-white/10 text-white rounded-2xl rounded-bl-md')}>
                {m.role === 'assistant' ? <FormattedMessage text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex items-end gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5"><Zap className="h-3.5 w-3.5 text-white" /></div><div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">{[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div></div>}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map(s => <button key={s} onClick={() => send(s)} className="flex-none text-xs bg-white/10 hover:bg-gray-200 text-gray-300 font-medium rounded-full px-4 py-2 transition-colors whitespace-nowrap">{s}</button>)}
          </div>
        )}
        <div className="px-4 pb-6 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-2.5">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything…" autoFocus className="flex-1 bg-transparent text-white placeholder-gray-400 text-sm focus:outline-none" />
            <button onClick={() => send()} disabled={!input.trim() || loading} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all', input.trim() && !loading ? 'bg-accent text-white' : 'bg-gray-300 text-gray-400')}><Send className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </>
  );
}

import { AgryxIntro } from '@/components/agryx-intro';
import { MobileNav } from '@/components/layout/mobile-nav';
import { RoleSwitcher } from '@/components/role-switcher';
import { useRole } from '@/hooks/use-role';

// ── Business quotes — new one on every mount/refresh ────────────────────────
const BUSINESS_QUOTES = [
  "Revenue is vanity, profit is sanity, cash is king.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Small daily improvements are the key to staggering long-term results.",
  "Your margin is your business. Protect it like it's your paycheck — because it is.",
  "Every dollar of shrink is a dollar you already paid for and never sold.",
  "Inventory sitting on a shelf isn't an asset, it's cash you can't spend.",
  "The customer in front of you is worth more than the one you're chasing.",
  "A store that's always 'about to' restock is a store that's always losing sales.",
  "Cash flow problems rarely start with sales. They start with not knowing your numbers.",
  "You can't manage what you don't measure — check your report every single day.",
  "Good employees don't leave bad jobs, they leave bad management.",
  "The fastest way to grow profit isn't more sales, it's fewer losses.",
  "A short drawer once is a mistake. A short drawer every week is a system problem.",
  "Price for the customer you have, not the one you wish you had.",
  "Vendors respect owners who know their invoices better than the sales rep does.",
  "The store that tracks everything is the store that's never surprised.",
  "Slow-moving inventory is a decision you made a while ago that you haven't undone yet.",
  "You don't lose money on a bad month. You lose it on twelve bad months you never noticed.",
  "Consistency beats intensity. Show up, check the numbers, every day.",
  "The owner who knows their fuel margin sleeps better than the one who guesses.",
  "Every hour you save on paperwork is an hour you can spend on customers.",
  "A store runs itself only after the owner has run it perfectly first.",
  "Trust, but verify — especially your own drawer count.",
  "The best inventory system is the one you actually use.",
  "Growth hides problems. A slowdown reveals them.",
  "Your busiest day tells you what you're good at. Your slowest day tells you what to fix.",
  "Nobody plans to fail. They just fail to plan for shrink, spoilage, and slow season.",
  "The store that adapts fastest to what's selling wins the season.",
  "Undercharging isn't generosity, it's a leak in your own boat.",
  "A well-run gas station is a machine — every part should be checked, not assumed.",
];

function toDarkIcon(lightClasses: string): string {
  const match = lightClasses.match(/bg-([a-z]+)-50/);
  const color = match ? match[1] : 'gray';
  return `bg-${color}-500/10 text-${color}-400`;
}

function getRandomQuote(): string {
  return BUSINESS_QUOTES[Math.floor(Math.random() * BUSINESS_QUOTES.length)];
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { store, userEmail } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [showAI, setShowAI] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote);
  const [showAgryx, setShowAgryx] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!mounted) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = 'agryx_greeted_' + today;
      if (!sessionStorage.getItem(key)) {
        setShowAgryx(true);
        sessionStorage.setItem(key, '1');
      }
    } catch { /* private browsing — just skip the greeting */ }
  }, [mounted]);
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
      setDataReady(true);
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
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications aren\'t supported in this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — cannot create a real push subscription.');
        alert('Notifications aren\'t fully set up yet on the server. Contact support.');
        return;
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = window.atob(base64);
        return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
      };

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch('/api/push-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, store_id: store?.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('push-subscribe failed:', data);
        alert(`Could not enable notifications: ${data.error || 'please try again'}`);
        return;
      }

      setNotifEnabled(true);
      reg.showNotification('RYXSOR AI', {
        body: 'Notifications enabled! You\'ll get alerts for low stock, short drawers, and daily summaries.',
        icon: '/icon-192.png',
      });
    } catch (err: any) {
      console.error('enableNotifications failed:', err);
      alert(`Could not enable notifications: ${err?.message || 'please try again'}`);
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
  const storeName = store?.name || 'Your Store';

  const healthScore = Math.max(0, Math.min(100, 80
    - (outOfStock * 5)
    - (lowStock * 2)
    - (pendingInv * 3)
    - (isShort ? 15 : 0)
    + (hasReport ? 10 : -10)
  ));

  const APPS = [
    { href: '/cashier',     icon: DollarSign, label: 'Cashier Actions', sub: 'Drop · Paid out · Vendor', badge: 0, color: 'bg-green-500/10 text-green-400' },
    { href: '/pos',         icon: BarChart3,  label: 'Daily Reports',    sub: 'Upload & review',    badge: 0,          color: 'bg-red-50 text-accent' },
    { href: '/invoices',    icon: FileText,   label: 'Invoices',         sub: 'Scan vendor invoices', badge: pendingInv, color: 'bg-pink-500/10 text-pink-400' },
    { href: '/inventory',   icon: Package,    label: 'Inventory',        sub: 'Stock & movement',   badge: outOfStock,  color: 'bg-blue-500/10 text-blue-400' },
    { href: '/ordering',    icon: Brain,      label: 'AI Ordering',      sub: '90-day reorders',    badge: 0,           color: 'bg-violet-500/10 text-violet-400' },
    { href: '/alerts',      icon: Bell,       label: 'Alerts',           sub: 'Price & stock',      badge: 0,           color: 'bg-amber-500/10 text-amber-400' },
    { href: '/reports',     icon: TrendingUp, label: 'Reports & P&L',    sub: 'Trends & analytics', badge: 0,           color: 'bg-green-500/10 text-green-400' },
    { href: '/employees',   icon: Users,      label: 'Employees',        sub: 'Time clock & pay',   badge: staffIn,     color: 'bg-cyan-500/10 text-cyan-400' },
    { href: '/fuel',        icon: Fuel,       label: 'Fuel Margins',     sub: 'Cost vs price',      badge: 0,           color: 'bg-orange-500/10 text-orange-400' },
    { href: '/shrink',      icon: AlertTriangle, label: 'Shrink & Waste',sub: 'Loss tracking',      badge: 0,           color: 'bg-red-500/10 text-red-400' },
    { href: '/performance', icon: Users,      label: 'Performance',      sub: 'Employee stats',     badge: 0,           color: 'bg-indigo-500/10 text-indigo-400' },
    { href: '/trends',      icon: TrendingUp, label: 'Annual Trends',    sub: 'Year over year',     badge: 0,           color: 'bg-teal-500/10 text-teal-400' },
    { href: '/email',       icon: Mail,       label: 'Email Reader',     sub: 'AI inbox summaries', badge: 0,           color: 'bg-blue-500/10 text-blue-400' },
    { href: '/billing',     icon: Receipt,    label: 'Invoicing',        sub: 'Bill your customers', badge: 0,           color: 'bg-purple-500/10 text-purple-400' },
    { href: '/tax',         icon: Receipt,    label: 'Tax Reports',      sub: 'Quarterly filing',   badge: 0,           color: 'bg-emerald-500/10 text-emerald-400' },
    { href: '/deposit',     icon: DollarSign, label: 'Deposit Slip',     sub: 'Auto-generate',      badge: 0,           color: 'bg-green-500/10 text-green-400' },
    { href: '/bank',        icon: Building2,  label: 'Bank Recon',       sub: 'Match deposits',     badge: 0,           color: 'bg-blue-500/10 text-blue-400' },
    { href: '/vendors',     icon: Shield,     label: 'Vendors',          sub: 'Price tracking',     badge: 0,           color: 'bg-white/5 text-gray-400' },
    { href: '/search',      icon: Brain,      label: 'Search',           sub: 'Find anything',      badge: 0,           color: 'bg-white/5 text-gray-400' },
    { href: '/migration',   icon: Download,   label: 'Import Data',      sub: 'CSV import',         badge: 0,           color: 'bg-white/5 text-gray-500' },
    { href: '/settings',    icon: Settings,   label: 'Settings',         sub: 'Store & connector',  badge: 0,           color: 'bg-white/5 text-gray-500' },
  ];

  const { role } = useRole();
  const MANAGER_PAGES = ['/pos', '/invoices', '/inventory', '/ordering', '/alerts', '/cashier'];
  const EMPLOYEE_PAGES = ['/cashier', '/pos'];
  const visibleApps = APPS.filter(app => {
    if (role === 'owner') return true;
    if (role === 'manager') return MANAGER_PAGES.includes(app.href);
    return EMPLOYEE_PAGES.includes(app.href);
  });


  const OPS_NAV = [
    { href: '/cashier',   icon: DollarSign, label: 'Cashier Actions', badge: 0 },
    { href: '/invoices',  icon: FileText,   label: 'Invoices',        badge: pendingInv },
    { href: '/inventory', icon: Package,    label: 'Inventory',       badge: outOfStock },
    { href: '/ordering',  icon: Brain,      label: 'AI Ordering',     badge: 0 },
    { href: '/reports',   icon: TrendingUp, label: 'Reports & P&L',   badge: 0 },
    { href: '/employees', icon: Users,      label: 'Employees',       badge: staffIn },
    { href: '/vendors',   icon: Shield,     label: 'Vendors',         badge: 0 },
    { href: '/email',     icon: Mail,       label: 'Email Reader',    badge: 0 },
  ];
  const MGMT_NAV = [
    { href: '/billing',   icon: Receipt,       label: 'Invoicing' },
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

  const visibleOps = OPS_NAV.filter(item => role === 'owner' || (role === 'manager' ? MANAGER_PAGES.includes(item.href) : EMPLOYEE_PAGES.includes(item.href)));
  const visibleMgmt = role === 'owner' ? MGMT_NAV : [];

  return (
    <div className="md:flex md:min-h-screen bg-dark-bg min-h-screen">
      {/* Desktop sidebar — hidden on phone, shown on tablet/desktop widths */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:bg-dark-sidebar md:border-r md:border-dark-border md:shrink-0">
        <div className="px-5 py-5 border-b border-dark-border flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dark-red text-white font-black text-sm shadow-lg shadow-dark-red/20">R</div>
          <div className="min-w-0">
            <p className="font-black text-white text-sm leading-tight truncate">RYXSOR AI</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-dark-sub mb-2">Operations</p>
            <div className="space-y-0.5">
              {visibleOps.map(item => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-semibold transition-colors',
                      active ? 'bg-dark-red text-white' : 'text-dark-sub hover:bg-dark-card hover:text-white')}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-dark-red text-white text-[10px] font-black px-1">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-dark-sub mb-2">Management</p>
            <div className="space-y-0.5">
              {visibleMgmt.map(item => {
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={cn('flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-semibold transition-colors',
                      active ? 'bg-dark-red text-white' : 'text-dark-sub hover:bg-dark-card hover:text-white')}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
        <div className="px-4 py-4 border-t border-dark-border flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dark-purple/20 text-dark-purple font-bold text-xs shrink-0">
            {storeName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{storeName}</p>
            <p className="text-[11px] text-dark-sub truncate">Store Dashboard</p>
          </div>
          <button onClick={logout} className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-sub hover:bg-dark-card hover:text-white shrink-0">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main content — unchanged on mobile, becomes the right panel on desktop */}
      <div className="flex-1 pb-24 md:pb-8 md:bg-dark-bg md:min-h-screen">
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] italic text-dark-sub leading-snug">"{quote}"</p>
      </div>
      <div className="px-4 pt-6 pb-4 flex items-center gap-3 md:hidden bg-dark-sidebar border-b border-dark-border">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dark-red shadow-lg shadow-dark-red/20">
          <span className="text-white font-black text-sm tracking-tight">R</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-xl text-white leading-tight truncate">{storeName}</h1>
          <p className="text-xs text-dark-sub">{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher storeId={store?.id} />
          <button onClick={() => { setRefreshing(true); setQuote(getRandomQuote()); load(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-dark-sub hover:text-white hover:bg-dark-card transition-colors">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setShowAI(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-dark-primary text-white shadow-lg shadow-dark-primary/30 relative">
            <Zap className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-dark-green border border-dark-sidebar" />
          </button>
          <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-dark-sub hover:text-white hover:bg-dark-card transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex px-8 pt-8 pb-4 items-start justify-between">
        <div>
          <p className="text-sm text-dark-sub">{greeting}, {store?.owner_name || 'there'} 👋</p>
          <h1 className="font-black text-2xl text-white leading-tight">{storeName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher storeId={store?.id} />
          <button onClick={() => { setRefreshing(true); setQuote(getRandomQuote()); load(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-dark-sub hover:text-white hover:bg-dark-card transition-colors">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
          <button onClick={() => setShowAI(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-dark-primary text-white shadow-lg shadow-dark-primary/30 relative">
            <Zap className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-dark-green border border-dark-sidebar" />
          </button>
        </div>
      </div>

      <div className="px-4 md:px-8 space-y-5">
        {/* Store Health */}
        <div className="bg-dark-card border border-dark-border rounded-xl2 shadow-lg shadow-black/10 p-4 flex items-center gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black text-xl text-white',
            healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-red-500')}>
            {healthScore}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">
              {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Needs Attention'}
            </p>
            <p className="text-xs text-dark-sub mt-0.5">Store Health</p>
          </div>
        </div>

        {/* Push notification prompt */}
        {!notifEnabled && (
          <button onClick={enableNotifications} className="w-full rounded-2xl bg-dark-purple/10 border border-dark-purple/20 p-4 flex items-center gap-3 text-left">
            <Bell className="h-5 w-5 text-dark-purple shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Enable notifications</p>
              <p className="text-xs text-dark-sub">Get daily store summary at closing time</p>
            </div>
            <ChevronRight className="h-4 w-4 text-dark-sub" />
          </button>
        )}

        {/* App grid */}
        <div>
          <p className="text-dark-sub uppercase tracking-wider text-[11px] font-bold mb-2">Quick Access</p>

          {/* Mobile: vertical stacked cards */}
          <div className="md:hidden space-y-3">
            {visibleApps.map(app => (
              <Link key={app.href} href={app.href}
                className="rounded-xl2 bg-dark-card border border-dark-border shadow-lg shadow-black/10 p-4 flex items-center gap-3 active:scale-[0.98] transition-all relative">
                <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', app.color)}>
                  <app.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white leading-tight">{app.label}</p>
                  <p className="text-sm text-dark-sub mt-0.5 leading-tight">{app.sub}</p>
                </div>
                {app.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-dark-red text-white text-[10px] font-black px-1.5 mr-1">
                    {app.badge}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-dark-sub shrink-0" />
              </Link>
            ))}
          </div>

          {/* Desktop: premium dark 2-column grid */}
          <div className="hidden md:grid md:grid-cols-2 md:gap-3">
            {visibleApps.map(app => (
              <Link key={app.href} href={app.href}
                className="rounded-xl2 bg-dark-card border border-dark-border p-4 flex items-center gap-3 hover:border-dark-primary/40 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden shadow-lg shadow-black/10">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', app.color)}>
                  <app.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{app.label}</p>
                  <p className="text-xs text-dark-sub mt-0.5 leading-tight">{app.sub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-dark-sub shrink-0" />
                {app.badge > 0 && (
                  <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-dark-red text-white text-[10px] font-black px-1">
                    {app.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
      </div>

      {showAgryx && dataReady && (
        <AgryxIntro
          ownerName={store?.owner_name || (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ') : 'there')}
          storeName={storeName}
          grossSales={grossSales}
          weekSales={weekSales}
          outOfStock={outOfStock}
          lowStock={lowStock}
          shortOver={shortOver}
          hasReport={hasReport}
          healthScore={healthScore}
          onDismiss={() => setShowAgryx(false)}
        />
      )}
      {showAI && <AICopilot onClose={() => setShowAI(false)} storeId={store?.id} />}
      <MobileNav />
    </div>
  );
}
