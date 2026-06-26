'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { AIUpload } from '@/components/ui/ai-upload';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfDay, startOfMonth, subDays, format, getDaysInMonth, startOfMonth as SOM } from 'date-fns';
import { Calendar, Archive, TrendingUp, Calculator, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';

type Tab = 'daily' | 'monthly' | 'calendar' | 'archive';

export default function ReportsPage() {
  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('daily');
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayData, setDayData] = useState<any>(null);

  // Net calculator
  const [adjustments, setAdjustments] = useState([
    { id: 'scratch', label: 'Scratch-Off Sold', amount: 0, type: 'deduct' as 'deduct' | 'add' },
    { id: 'lotto_paid', label: 'Lotto Paid Out', amount: 0, type: 'deduct' as 'deduct' | 'add' },
    { id: 'lotto_sales', label: 'Lotto Terminal', amount: 0, type: 'add' as 'deduct' | 'add' },
  ]);
  const [customAdj, setCustomAdj] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'deduct' | 'add'>('deduct');

  const fetchSales = useCallback(async (from: Date) => {
    if (!store) return; setLoading(true);
    const sb = createClient();
    const { data: s } = await sb.from('sales').select('*').eq('store_id', store.id).gte('created_at', from.toISOString()).order('created_at', { ascending: false });
    const ids = (s ?? []).map(x => x.id);
    let items: any[] = [];
    if (ids.length > 0) { const { data } = await sb.from('sale_items').select('*').in('sale_id', ids); items = data ?? []; }
    setSales(s ?? []); setSaleItems(items); setLoading(false);
  }, [store]);

  useEffect(() => {
    const from = tab === 'daily' ? startOfDay(new Date()) : tab === 'monthly' || tab === 'calendar' ? startOfMonth(new Date()) : subDays(new Date(), 365);
    fetchSales(from);
  }, [tab, fetchSales]);

  const gross = sales.reduce((s, r) => s + Number(r.total), 0);
  const profit = saleItems.reduce((s, li) => s + (Number(li.unit_price) - Number(li.unit_cost)) * Number(li.quantity), 0);
  const allAdj = [...adjustments, ...customAdj];
  const net = gross - allAdj.filter(a => a.type === 'deduct').reduce((s, a) => s + a.amount, 0) + allAdj.filter(a => a.type === 'add').reduce((s, a) => s + a.amount, 0);

  // Calendar
  const daysInMonth = getDaysInMonth(calDate);
  const monthStart = SOM(calDate);
  const firstDow = monthStart.getDay();
  const salesByDay = new Map<string, number>();
  for (const s of sales) { const k = format(new Date(s.created_at), 'yyyy-MM-dd'); salesByDay.set(k, (salesByDay.get(k) ?? 0) + Number(s.total)); }

  const openDay = async (dateStr: string) => {
    setSelectedDay(dateStr);
    if (!store) return;
    const from = new Date(dateStr + 'T00:00:00');
    const to = new Date(dateStr + 'T23:59:59');
    const sb = createClient();
    const { data: ds } = await sb.from('sales').select('*').eq('store_id', store.id).gte('created_at', from.toISOString()).lte('created_at', to.toISOString());
    const ids = (ds ?? []).map(s => s.id);
    let items: any[] = [];
    if (ids.length > 0) { const { data } = await sb.from('sale_items').select('*').in('sale_id', ids); items = data ?? []; }
    const dayGross = (ds ?? []).reduce((s, r) => s + Number(r.total), 0);
    const dayProfit = items.reduce((s, li) => s + (Number(li.unit_price) - Number(li.unit_cost)) * Number(li.quantity), 0);
    setDayData({ date: dateStr, gross: dayGross, profit: dayProfit, transactions: (ds ?? []).length, items });
  };

  // Hourly chart for daily
  const hourMap = new Map<string, number>();
  for (let h = 6; h <= 22; h++) hourMap.set(`${h > 12 ? h - 12 : h}${h < 12 ? 'a' : 'p'}`, 0);
  for (const s of sales) { const h = new Date(s.created_at).getHours(); if (h >= 6 && h <= 22) { const k = `${h > 12 ? h - 12 : h}${h < 12 ? 'a' : 'p'}`; hourMap.set(k, (hourMap.get(k) ?? 0) + Number(s.total)); } }
  const chartData = [...hourMap.entries()].map(([t, v]) => ({ t, v }));

  const Tip = ({ active, payload, label }: any) => active && payload?.length ? <div className="tile px-3 py-2 text-xs"><p className="text-muted mb-1">{label}</p><p className="num text-text font-bold">{fmt.currency(payload[0].value)}</p></div> : null;

  const TABS: { id: Tab; label: string }[] = [{ id: 'daily', label: 'Daily' }, { id: 'monthly', label: 'Monthly' }, { id: 'calendar', label: 'Calendar' }, { id: 'archive', label: 'Archive' }];

  return (
    <Screen title="Reports" subtitle="Daily hisab, monthly summary, full archive">
      <div className="space-y-5">
        {/* Modisoft upload */}
        <div className="tile p-5">
          <p className="text-sm font-semibold text-text mb-1">Sync Register</p>
          <p className="text-xs text-muted mb-3">Upload Modisoft report — AI extracts all numbers</p>
          <AIUpload label="Upload Daily Report" description="PDF or screenshot from Modisoft" endpoint="/api/scan-report" onResult={() => {}} compact />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedDay(null); setDayData(null); }} className={cn('flex-none rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', tab === t.id ? 'bg-accent text-white' : 'bg-card text-sub hover:text-text border border-border')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Daily / Monthly */}
        {(tab === 'daily' || tab === 'monthly') && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: 'Gross Sales', v: fmt.currency(gross) },
                { l: 'Net Sales', v: fmt.currency(net), accent: true },
                { l: 'Profit', v: fmt.currency(profit) },
              ].map(k => (
                <div key={k.l} className={cn('tile p-4', k.accent && 'border border-accent/30')}>
                  <p className="text-xs text-muted mb-1">{k.l}</p>
                  <p className={cn('num text-lg font-bold', k.accent ? 'text-accent' : 'text-text')}>{loading ? '—' : k.v}</p>
                </div>
              ))}
            </div>

            {tab === 'daily' && (
              <div className="tile p-5">
                <p className="section-title">Hourly Sales</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#2A2E3A" /><XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} /><Tooltip content={<Tip />} /><Bar dataKey="v" fill="#E53935" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Net calculator */}
            <div className="tile p-5">
              <div className="flex items-center gap-2 mb-4"><Calculator className="h-5 w-5 text-accent" /><p className="font-semibold text-text">Net Sales Calculator</p></div>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-border/60 text-sm"><span className="text-sub">Gross Revenue</span><span className="num font-bold text-text">{fmt.currency(gross)}</span></div>
                {allAdj.map(adj => (
                  <div key={adj.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', adj.type === 'deduct' ? 'bg-accent/8' : 'bg-green-500/5')}>
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold', adj.type === 'deduct' ? 'bg-accent' : 'bg-green-600')}>{adj.type === 'deduct' ? '−' : '+'}</span>
                    <span className="text-sm text-sub flex-1">{adj.label}</span>
                    {['scratch', 'lotto_paid', 'lotto_sales'].includes((adj as any).id) ? (
                      <div className="relative w-24"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span><input type="number" step="0.01" min="0" value={adjustments.find(a => a.id === (adj as any).id)?.amount || ''} onChange={e => setAdjustments(a => a.map(x => x.id === (adj as any).id ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))} className="w-full h-8 rounded-xl bg-card border border-border pl-7 pr-2 text-sm num text-text focus:border-accent focus:outline-none" placeholder="0" /></div>
                    ) : <span className="num text-sm text-sub">{fmt.currency((adj as any).amount)}</span>}
                    {!['scratch', 'lotto_paid', 'lotto_sales'].includes((adj as any).id) && <button onClick={() => setCustomAdj(a => a.filter(x => x.id !== (adj as any).id))} className="text-dim hover:text-accent"><Minus className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label" className="inp flex-1 h-9 text-xs" />
                  <input type="number" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="$" className="inp w-20 h-9 text-xs num" />
                  <select value={newType} onChange={e => setNewType(e.target.value as any)} className="inp w-24 h-9 text-xs">
                    <option value="deduct">Deduct</option><option value="add">Add</option>
                  </select>
                  <button onClick={() => { if (!newLabel || !newAmount) return; setCustomAdj(a => [...a, { id: `c_${Date.now()}`, label: newLabel, amount: parseFloat(newAmount) || 0, type: newType }]); setNewLabel(''); setNewAmount(''); }} className="btn btn-ghost h-9 px-3 text-xs"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-accent px-5 py-4 mt-2">
                  <span className="font-bold text-white text-base">NET SALES</span>
                  <span className="num text-2xl font-bold text-white">{fmt.currency(net)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Calendar */}
        {tab === 'calendar' && (
          <div className="tile p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5 text-sub" /></button>
              <p className="font-semibold text-text">{format(calDate, 'MMMM yyyy')}</p>
              <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5 text-sub" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <p key={i} className="text-center text-xs text-muted py-1">{d}</p>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = format(new Date(calDate.getFullYear(), calDate.getMonth(), day), 'yyyy-MM-dd');
                const daySales = salesByDay.get(dateStr) ?? 0;
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                const isSelected = selectedDay === dateStr;
                return (
                  <button key={day} onClick={() => openDay(dateStr)}
                    className={cn('rounded-xl p-1.5 text-center transition-all active:scale-95', isSelected ? 'bg-accent' : isToday ? 'border border-accent/50' : daySales > 0 ? 'bg-card hover:bg-border' : 'hover:bg-card')}>
                    <p className={cn('text-xs font-semibold', isSelected ? 'text-white' : isToday ? 'text-accent' : 'text-text')}>{day}</p>
                    {daySales > 0 && !isSelected && <p className="text-[9px] text-green-400 num leading-none">{fmt.currency(daySales).replace('$', '')}</p>}
                  </button>
                );
              })}
            </div>
            {dayData && (
              <div className="mt-5 border-t border-border pt-4 animate-fade-up">
                <p className="font-semibold text-text mb-3">{format(new Date(dayData.date + 'T12:00:00'), 'MMMM d, yyyy')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[{ l: 'Sales', v: fmt.currency(dayData.gross) }, { l: 'Profit', v: fmt.currency(dayData.profit) }, { l: 'Txns', v: String(dayData.transactions) }].map(k => (
                    <div key={k.l} className="bg-card rounded-xl p-3 text-center"><p className="text-xs text-muted mb-1">{k.l}</p><p className="num font-bold text-text">{k.v}</p></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Archive */}
        {tab === 'archive' && (
          <div>
            <p className="text-sm text-muted mb-4">All historical data is saved permanently. Click any date on the Calendar tab to view any day's report.</p>
            <div className="tile p-5">
              <p className="section-title">Summary — Last 365 Days</p>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sub text-sm">Total Revenue</span><span className="num font-bold text-text">{fmt.currency(gross)}</span></div>
                <div className="flex justify-between"><span className="text-sub text-sm">Total Profit</span><span className="num font-bold text-green-400">{fmt.currency(profit)}</span></div>
                <div className="flex justify-between"><span className="text-sub text-sm">Transactions</span><span className="num font-bold text-text">{sales.length}</span></div>
                <div className="flex justify-between"><span className="text-sub text-sm">Avg Daily Sales</span><span className="num font-bold text-text">{fmt.currency(gross / Math.max(1, 365))}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
