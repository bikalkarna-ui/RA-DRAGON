'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  BarChart3, Package, Brain, Bell, FileText, TrendingUp,
  TrendingDown, Users, LogOut, RefreshCw, Zap, AlertTriangle,
  DollarSign, ArrowUpRight, ArrowDownRight, Store as StoreIcon,
  Plus, Send, MessageSquare, X, ChevronRight, Settings, Search, Upload
} from 'lucide-react';

const APPS = [
  { id: 'pos',       label: 'Daily Reports',  href: '/pos',       icon: BarChart3,  color: '#C0392B', bg: '#FEF2F2', desc: 'Close & upload reports'      },
  { id: 'invoices',  label: 'Invoices',       href: '/invoices',  icon: FileText,   color: '#DB2777', bg: '#FDF2F8', desc: 'Scan vendor invoices'        },
  { id: 'inventory', label: 'Inventory',      href: '/inventory', icon: Package,    color: '#2563EB', bg: '#EFF6FF', desc: 'Stock & movement history'    },
  { id: 'ordering',  label: 'AI Ordering',    href: '/ordering',  icon: Brain,      color: '#7C3AED', bg: '#F5F3FF', desc: '90-day smart reorders'       },
  { id: 'alerts',    label: 'Price Alerts',   href: '/alerts',    icon: Bell,       color: '#D97706', bg: '#FFFBEB', desc: 'Cost change notifications'   },
  { id: 'reports',   label: 'Reports & P&L',  href: '/reports',   icon: TrendingUp, color: '#059669', bg: '#ECFDF5', desc: 'Profit, loss & trends'       },
  { id: 'employees', label: 'Employees',      href: '/employees', icon: Users,      color: '#0891B2', bg: '#ECFEFF', desc: 'Time clock & payroll'        },
  { id: 'search',    label: 'Search',         href: '/search',    icon: Search,     color: '#EA580C', bg: '#FFF7ED', desc: 'Find anything instantly'     },
  { id: 'migration', label: 'Import Data',    href: '/migration', icon: Upload,     color: '#6B7280', bg: '#F9FAFB', desc: 'CSV import'                  },
  { id: 'settings',  label: 'Settings',       href: '/settings',  icon: Settings,   color: '#374151', bg: '#F9FAFB', desc: 'Store & preferences'         },
];

// ── AI Copilot Chat ─────────────────────────────────────────────────────────
function AICopilot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: "Hi! Ask me anything about your store — today\'s sales, what to deposit, inventory, short/over, or anything else." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const SUGGESTIONS = ["Deposit amount today?", "What\'s running low?", "Week\'s total sales?", "Today\'s short/over"];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/ai-copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: messages }) });
      const data = await res.json();
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error. Try again.' }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet — ChatGPT style */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl border-t border-gray-200"
        style={{ height: '72vh', maxWidth: 680, margin: '0 auto' }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent shadow-red">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-black text-text text-sm leading-tight">RA Dragon AI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-muted font-medium">Knows your store data</p>
              </div>
            </div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex items-end gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={cn('max-w-[80%] px-4 py-3 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-accent text-white rounded-2xl rounded-br-md'
                  : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md')}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent mb-0.5">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
                {[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions — show only at start */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="flex-none text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full px-4 py-2 transition-colors whitespace-nowrap">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="px-4 pb-8 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything…"
              autoFocus
              className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 text-sm focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95',
                input.trim() && !loading ? 'bg-accent text-white shadow-red' : 'bg-gray-300 text-gray-400')}>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const { store, stores, switchStore } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async (silent = false) => {
    if (!store) return;
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const sb = createClient();
      const today = new Date().toISOString().split('T')[0];
      const yday  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const week  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const [todayRes, ydayRes, weekRes, prodRes, invRes, clockRes] = await Promise.all([
        sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
        sb.from('daily_reports').select('gross_sales,net_sales').eq('store_id', store.id).eq('report_date', yday).maybeSingle(),
        sb.from('daily_reports').select('gross_sales').eq('store_id', store.id).gte('report_date', week).order('report_date'),
        sb.from('products').select('quantity,min_quantity,unit_cost,unit_price').eq('store_id', store.id).eq('is_active', true),
        sb.from('invoices').select('id').eq('store_id', store.id).eq('status', 'NEEDS_REVIEW'),
        sb.from('time_clock').select('employee_id').eq('store_id', store.id).is('clock_out', null),
      ]);

      const n = (v: any) => Number(v || 0);
      const ps = prodRes.data || [];
      const invValue = ps.reduce((s: number, p: any) => s + n(p.unit_cost) * n(p.quantity), 0);
      const outOfStock = ps.filter((p: any) => n(p.quantity) === 0).length;
      const lowStock = ps.filter((p: any) => n(p.quantity) > 0 && n(p.quantity) <= n(p.min_quantity)).length;
      const weekSales = (weekRes.data || []).reduce((s: number, r: any) => s + n(r.gross_sales), 0);
      const grossToday = n(todayRes.data?.gross_sales);
      const grossYday  = n(ydayRes.data?.gross_sales);
      const vsYday = grossYday > 0 ? ((grossToday - grossYday) / grossYday * 100) : null;
      const shortOver = n(todayRes.data?.drawer_difference);

      // Store health score
      const healthFactors = [
        outOfStock === 0 ? 20 : Math.max(0, 20 - outOfStock * 2),
        grossToday > 0 ? 20 : 0,
        shortOver === 0 ? 20 : Math.max(0, 20 - Math.abs(shortOver) / 10),
        (invRes.data || []).length === 0 ? 20 : 10,
        lowStock < 5 ? 20 : Math.max(0, 20 - lowStock * 2),
      ];
      const healthScore = healthFactors.reduce((a, b) => a + b, 0);

      setData({
        today: todayRes.data,
        grossToday, grossYday, vsYday,
        netSales: n(todayRes.data?.net_sales),
        cashSales: n(todayRes.data?.cash_sales),
        creditSales: n(todayRes.data?.credit_sales),
        debitSales: n(todayRes.data?.debit_sales),
        ebtSales: n(todayRes.data?.ebt_sales),
        lotterySales: n(todayRes.data?.lottery_sales),
        fuelSales: n(todayRes.data?.fuel_sales),
        safeDrops: n(todayRes.data?.safe_drops),
        paidOuts: n(todayRes.data?.paid_outs),
        shortOver,
        weekSales, invValue, outOfStock, lowStock,
        pendingInvoices: (invRes.data || []).length,
        clockedIn: (clockRes.data || []).length,
        healthScore,
      });

      // Load notifications
      try {
        const nr = await fetch('/api/notifications');
        if (nr.ok) { const nd = await nr.json(); setNotifications((nd.notifications || []).filter((n: any) => !n.is_read).slice(0, 5)); }
      } catch {}

    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;

  const logout = async () => {
    try { await createClient().auth.signOut(); } catch {}
    window.location.href = '/';
  };

  const n = (v: any) => Number(v || 0);
  const d = data || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const healthColor = d.healthScore >= 80 ? 'text-green-600' : d.healthScore >= 60 ? 'text-amber-600' : 'text-accent';
  const healthBg    = d.healthScore >= 80 ? 'bg-green-50'   : d.healthScore >= 60 ? 'bg-amber-50'   : 'bg-red-50';
  const healthLabel = d.healthScore >= 80 ? 'Excellent' : d.healthScore >= 60 ? 'Good' : 'Needs attention';

  return (
    <div className="min-h-screen bg-white">
      {showCopilot && <AICopilot onClose={() => setShowCopilot(false)} />}

      <div className="screen py-6 pb-24">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-sub font-medium">{greeting}</p>
            <h1 className="text-2xl font-black text-text mt-0.5 leading-tight">{store?.name ?? 'RA Dragon'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setRefreshing(true); load(true); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            <button onClick={() => setShowCopilot(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white hover:bg-red-700 transition-colors relative">
              <Zap className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-green-400 border-2 border-white" />
            </button>
            <button onClick={logout}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

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

        {loading ? (
          <div className="tile p-10 text-center mb-5"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>
        ) : (
          <>
            {/* Main KPI card */}
            <div className="tile p-5 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Today's Gross Sales</p>
                  <p className="num text-5xl font-black text-text">{fmt.currency(d.grossToday)}</p>
                  {d.vsYday !== null && (
                    <div className={cn('flex items-center gap-1.5 mt-2 text-sm font-semibold', d.vsYday >= 0 ? 'text-green-600' : 'text-accent')}>
                      {d.vsYday >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      <span>{Math.abs(d.vsYday).toFixed(1)}% vs yesterday ({fmt.currency(d.grossYday)})</span>
                    </div>
                  )}
                  {d.vsYday === null && d.grossToday === 0 && (
                    <p className="text-muted text-sm mt-1">No report uploaded today yet</p>
                  )}
                </div>
                <div className={cn('rounded-2xl px-4 py-3 text-center shrink-0', healthBg)}>
                  <p className={cn('num font-black text-2xl', healthColor)}>{d.healthScore}</p>
                  <p className={cn('text-[10px] font-bold uppercase tracking-wide', healthColor)}>{healthLabel}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Store Health</p>
                </div>
              </div>

              {/* SHORT/OVER prominent */}
              {d.grossToday > 0 && (
                <div className={cn('rounded-2xl p-4 mb-4 border-2',
                  d.shortOver < -0.5 ? 'border-red-400 bg-red-50' :
                  d.shortOver > 0.5  ? 'border-green-400 bg-green-50' :
                  'border-gray-200 bg-gray-50')}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">SHORT / OVER</p>
                      <p className={cn('num font-black text-3xl',
                        d.shortOver < -0.5 ? 'text-red-700' : d.shortOver > 0.5 ? 'text-green-700' : 'text-gray-500')}>
                        {d.shortOver > 0 ? '+' : ''}{fmt.currency(d.shortOver)}
                      </p>
                    </div>
                    <p className={cn('text-sm font-semibold text-right',
                      d.shortOver < -0.5 ? 'text-red-600' : d.shortOver > 0.5 ? 'text-green-600' : 'text-gray-500')}>
                      {d.shortOver < -0.5 ? `⚠ Drawer short\n$${Math.abs(d.shortOver).toFixed(2)}` :
                       d.shortOver > 0.5  ? `✓ Drawer over\n$${d.shortOver.toFixed(2)}` : '✓ Exact'}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment breakdown */}
              {d.grossToday > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Cash',    value: d.cashSales,   color: 'text-green-700' },
                    { label: 'Credit',  value: d.creditSales, color: 'text-blue-700' },
                    { label: 'Debit',   value: d.debitSales,  color: 'text-purple-700' },
                    { label: 'EBT',     value: d.ebtSales,    color: 'text-orange-700' },
                  ].map(s => (
                    <div key={s.label} className="bg-surface rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-muted font-medium">{s.label}</p>
                      <p className={cn('num font-black text-sm mt-0.5', s.color)}>{fmt.currency(s.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* More KPIs */}
            {d.grossToday > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Lottery Sales',  value: d.lotterySales, icon: '🎰', color: 'text-yellow-700', bg: 'bg-yellow-50' },
                  { label: 'Fuel Sales',     value: d.fuelSales,    icon: '⛽', color: 'text-blue-700',   bg: 'bg-blue-50' },
                  { label: 'Safe Drops',     value: d.safeDrops,    icon: '🔒', color: 'text-gray-700',   bg: 'bg-gray-50' },
                  { label: 'Paid Outs',      value: d.paidOuts,     icon: '💸', color: 'text-red-700',    bg: 'bg-red-50' },
                ].filter(k => k.value > 0).map(k => (
                  <div key={k.label} className={cn('tile p-4', k.bg)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{k.icon}</span>
                      <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                    </div>
                    <p className={cn('num font-black text-xl', k.color)}>{fmt.currency(k.value)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Store overview */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Link href="/inventory" className={cn('tile p-4 text-center hover:shadow-md transition-shadow', d.outOfStock > 0 && 'border-2 border-red-300 bg-red-50')}>
                <p className={cn('num text-2xl font-black', d.outOfStock > 0 ? 'text-accent' : 'text-text')}>{d.outOfStock}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Out of Stock</p>
              </Link>
              <Link href="/inventory" className={cn('tile p-4 text-center hover:shadow-md transition-shadow', d.lowStock > 5 && 'border-2 border-amber-300 bg-amber-50')}>
                <p className={cn('num text-2xl font-black', d.lowStock > 5 ? 'text-amber-600' : 'text-text')}>{d.lowStock}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Low Stock</p>
              </Link>
              <Link href="/employees" className="tile p-4 text-center hover:shadow-md transition-shadow">
                <p className="num text-2xl font-black text-text">{d.clockedIn}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Staff In</p>
              </Link>
              <Link href="/invoices" className={cn('tile p-4 text-center hover:shadow-md transition-shadow', d.pendingInvoices > 0 && 'border-2 border-amber-300 bg-amber-50')}>
                <p className={cn('num text-2xl font-black', d.pendingInvoices > 0 ? 'text-amber-600' : 'text-text')}>{d.pendingInvoices}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Pending Inv.</p>
              </Link>
              <div className="tile p-4 text-center">
                <p className="num text-2xl font-black text-text">{fmt.currency(d.invValue).replace('$','$').split('.')[0]}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Inv. Value</p>
              </div>
              <div className="tile p-4 text-center">
                <p className="num text-2xl font-black text-text">{fmt.currency(d.weekSales).replace('$','').split('.')[0]}</p>
                <p className="text-xs text-muted font-medium mt-0.5">Week Sales</p>
              </div>
            </div>

            {/* AI Insights */}
            {notifications.length > 0 && (
              <div className="tile p-5 mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-violet-600" />
                  <p className="font-bold text-text">Smart Alerts</p>
                </div>
                <div className="space-y-2">
                  {notifications.map((n: any, i: number) => (
                    <div key={i} className={cn('rounded-xl px-4 py-3 text-sm',
                      n.type === 'out_of_stock' ? 'bg-red-50 border border-red-200' :
                      n.type === 'low_stock'    ? 'bg-amber-50 border border-amber-200' :
                      'bg-violet-50 border border-violet-200')}>
                      <p className={cn('font-semibold',
                        n.type === 'out_of_stock' ? 'text-red-800' :
                        n.type === 'low_stock'    ? 'text-amber-800' : 'text-violet-800')}>{n.title}</p>
                      <p className={cn('text-xs mt-0.5',
                        n.type === 'out_of_stock' ? 'text-red-600' :
                        n.type === 'low_stock'    ? 'text-amber-600' : 'text-violet-600')}>{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* App grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {APPS.map(app => {
                const Icon = app.icon;
                const badge =
                  app.id === 'alerts'    ? d.pendingInvoices :
                  app.id === 'inventory' ? d.outOfStock :
                  0;
                return (
                  <Link key={app.id} href={app.href}
                    className="tile tile-hover p-4 flex flex-col gap-3 active:scale-[0.98] transition-transform">
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: app.bg }}>
                        <Icon className="h-5 w-5" style={{ color: app.color }} />
                      </div>
                      {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold px-1">{badge}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text">{app.label}</p>
                      <p className="text-xs text-muted mt-0.5">{app.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* AI Copilot floating button */}
        <button onClick={() => setShowCopilot(true)}
          className="fixed bottom-8 right-6 flex items-center gap-2.5 bg-gray-900 text-white rounded-full px-5 py-3.5 shadow-2xl hover:bg-gray-800 active:scale-95 transition-all z-40">
          <Zap className="h-5 w-5 text-accent" />
          <span className="font-bold text-sm">Ask AI</span>
          <span className="flex h-2 w-2 rounded-full bg-green-400" />
        </button>
      </div>
    </div>
  );
}
