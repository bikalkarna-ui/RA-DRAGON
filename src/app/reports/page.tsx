'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDOR_COMPANIES } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from 'date-fns';
import { Calculator, TrendingUp, DollarSign, ShoppingCart, Minus, Plus, RefreshCw } from 'lucide-react';

export default function ReportsPage() {
  const { store } = useStore();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | '30d'>('today');
  const [sales, setSales] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Net sales adjustments — manual line items owner can add/remove
  const [adjustments, setAdjustments] = useState([
    { id: 'scratch_off', label: 'Scratch-Off Lottery', amount: 0, type: 'deduct' as 'deduct' | 'add' },
    { id: 'lotto_paid', label: 'Lotto Paid Out', amount: 0, type: 'deduct' as 'deduct' | 'add' },
    { id: 'lotto_sales', label: 'Lotto Terminal Sales', amount: 0, type: 'add' as 'deduct' | 'add' },
  ]);
  const [customAdj, setCustomAdj] = useState<{ id: string; label: string; amount: number; type: 'deduct' | 'add' }[]>([]);
  const [newAdjLabel, setNewAdjLabel] = useState('');
  const [newAdjAmount, setNewAdjAmount] = useState('');
  const [newAdjType, setNewAdjType] = useState<'deduct' | 'add'>('deduct');

  const fetchData = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const sb = createClient();
    const now = new Date();
    const from = period === 'today' ? startOfDay(now) : period === 'week' ? startOfWeek(now) : period === 'month' ? startOfMonth(now) : subDays(now, 30);

    const { data: salesData } = await sb.from('sales').select('*').eq('store_id', store.id).gte('created_at', from.toISOString()).order('created_at', { ascending: false });
    const ids = (salesData ?? []).map(s => s.id);
    let items: any[] = [];
    if (ids.length > 0) {
      const { data } = await sb.from('sale_items').select('*').in('sale_id', ids);
      items = data ?? [];
    }
    setSales(salesData ?? []);
    setSaleItems(items);
    setLoading(false);
  }, [store, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grossRevenue = sales.reduce((s, r) => s + Number(r.total), 0);
  const totalTax = sales.reduce((s, r) => s + Number(r.tax), 0);
  const grossProfit = saleItems.reduce((s, li) => s + (Number(li.unit_price) - Number(li.unit_cost)) * Number(li.quantity), 0);

  // Net sales calculation
  const allAdj = [...adjustments, ...customAdj];
  const totalDeductions = allAdj.filter(a => a.type === 'deduct').reduce((s, a) => s + a.amount, 0);
  const totalAdditions = allAdj.filter(a => a.type === 'add').reduce((s, a) => s + a.amount, 0);
  const netSales = grossRevenue - totalDeductions + totalAdditions;

  // By vendor
  const vendorMap = new Map<string, { revenue: number; profit: number; qty: number }>();
  for (const li of saleItems) {
    const key = li.vendor_company ?? 'Other';
    const cur = vendorMap.get(key) ?? { revenue: 0, profit: 0, qty: 0 };
    vendorMap.set(key, {
      revenue: cur.revenue + Number(li.line_total),
      profit: cur.profit + (Number(li.unit_price) - Number(li.unit_cost)) * Number(li.quantity),
      qty: cur.qty + Number(li.quantity),
    });
  }

  // By product (best sellers)
  const prodMap = new Map<string, { name: string; revenue: number; qty: number; profit: number }>();
  for (const li of saleItems) {
    const key = li.product_id ?? li.product_name;
    const cur = prodMap.get(key) ?? { name: li.product_name, revenue: 0, qty: 0, profit: 0 };
    prodMap.set(key, { name: li.product_name, revenue: cur.revenue + Number(li.line_total), qty: cur.qty + Number(li.quantity), profit: cur.profit + (Number(li.unit_price) - Number(li.unit_cost)) * Number(li.quantity) });
  }
  const topProducts = [...prodMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // By employee
  const empMap = new Map<string, { count: number; revenue: number }>();
  for (const s of sales) {
    const key = s.employee_name ?? 'No cashier';
    const cur = empMap.get(key) ?? { count: 0, revenue: 0 };
    empMap.set(key, { count: cur.count + 1, revenue: cur.revenue + Number(s.total) });
  }

  // Daily chart
  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
  const dayMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    dayMap.set(format(subDays(new Date(), i), period === 'today' ? 'ha' : 'MMM d'), 0);
  }
  for (const s of sales) {
    const key = format(new Date(s.created_at), period === 'today' ? 'ha' : 'MMM d');
    dayMap.set(key, (dayMap.get(key) ?? 0) + Number(s.total));
  }
  const chartData = [...dayMap.entries()].map(([date, revenue]) => ({ date, revenue }));

  const updateAdj = (id: string, amount: number) => setAdjustments(a => a.map(x => x.id === id ? { ...x, amount } : x));
  const addCustomAdj = () => {
    if (!newAdjLabel || !newAdjAmount) return;
    setCustomAdj(a => [...a, { id: `custom_${Date.now()}`, label: newAdjLabel, amount: parseFloat(newAdjAmount) || 0, type: newAdjType }]);
    setNewAdjLabel(''); setNewAdjAmount('');
  };
  const removeCustomAdj = (id: string) => setCustomAdj(a => a.filter(x => x.id !== id));

  const Tip = ({ active, payload, label }: any) => active && payload?.length ? (
    <div className="d-card p-2 text-xs"><p className="text-obsidian-400 mb-1">{label}</p><p className="text-fire-400">{fmt.currency(payload[0].value)}</p></div>
  ) : null;

  return (
    <AppShell title="Sales Reports" storeName={store?.name}>
      <div className="space-y-5">
        {/* Period picker */}
        <div className="flex flex-wrap gap-2">
          {[{ id: 'today', label: 'Today' }, { id: 'week', label: 'This Week' }, { id: 'month', label: 'This Month' }, { id: '30d', label: 'Last 30 Days' }].map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id as any)}
              className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-all', period === p.id ? 'bg-fire-700 text-white shadow-fire-sm' : 'border border-dragon-border text-obsidian-400 hover:border-fire-800 hover:text-fire-400')}>
              {p.label}
            </button>
          ))}
          <button onClick={fetchData} className="border border-dragon-border rounded-lg px-3 py-2 text-obsidian-400 hover:text-fire-400 hover:border-fire-800 transition-all">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Gross Revenue', value: fmt.currency(grossRevenue), icon: DollarSign },
            { label: 'Net Sales', value: fmt.currency(netSales), icon: Calculator, glow: true },
            { label: 'Gross Profit', value: fmt.currency(grossProfit), icon: TrendingUp },
            { label: 'Transactions', value: String(sales.length), icon: ShoppingCart },
          ].map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={cn('d-card p-4', (k as any).glow && 'shadow-fire-sm border-fire-900/50')}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-obsidian-500 uppercase tracking-wide">{k.label}</p>
                  <Icon className={cn('h-4 w-4', (k as any).glow ? 'text-fire-500' : 'text-obsidian-600')} />
                </div>
                <p className="mono text-xl font-bold text-white">{loading ? '—' : k.value}</p>
              </div>
            );
          })}
        </div>

        {/* NET SALES CALCULATOR — the key feature */}
        <div className="d-card p-5 border-fire-900/40 shadow-fire-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-fire-500" />
            <h3 className="font-bold text-white text-base">Net Sales Calculator</h3>
            <span className="text-xs text-obsidian-500">— adjust to get your real total</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-dragon-border">
              <span className="text-sm font-semibold text-white">Gross Revenue</span>
              <span className="mono text-sm font-bold text-white">{fmt.currency(grossRevenue)}</span>
            </div>

            {adjustments.map(adj => (
              <div key={adj.id} className={cn('flex items-center gap-3 rounded-lg px-3 py-2', adj.type === 'deduct' ? 'bg-fire-950/30' : 'bg-obsidian-800/30')}>
                <div className={cn('flex h-5 w-5 items-center justify-center rounded text-white text-xs font-bold shrink-0', adj.type === 'deduct' ? 'bg-fire-700' : 'bg-obsidian-600')}>
                  {adj.type === 'deduct' ? '−' : '+'}
                </div>
                <span className="text-sm text-obsidian-300 flex-1">{adj.label}</span>
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-obsidian-500 text-sm">$</span>
                  <input type="number" step="0.01" min="0" value={adj.amount || ''} onChange={e => updateAdj(adj.id, parseFloat(e.target.value) || 0)}
                    className="w-full h-8 rounded-lg border border-dragon-border bg-obsidian-900 pl-6 pr-2 text-sm text-white mono focus:border-fire-700 focus:outline-none" placeholder="0.00" />
                </div>
                <span className={cn('mono text-sm font-medium w-20 text-right', adj.type === 'deduct' ? 'text-fire-400' : 'text-obsidian-300')}>
                  {adj.type === 'deduct' ? '−' : '+'}{fmt.currency(adj.amount)}
                </span>
              </div>
            ))}

            {customAdj.map(adj => (
              <div key={adj.id} className={cn('flex items-center gap-3 rounded-lg px-3 py-2', adj.type === 'deduct' ? 'bg-fire-950/30' : 'bg-obsidian-800/30')}>
                <div className={cn('flex h-5 w-5 items-center justify-center rounded text-white text-xs font-bold shrink-0', adj.type === 'deduct' ? 'bg-fire-700' : 'bg-obsidian-600')}>
                  {adj.type === 'deduct' ? '−' : '+'}
                </div>
                <span className="text-sm text-obsidian-300 flex-1">{adj.label}</span>
                <span className={cn('mono text-sm font-medium', adj.type === 'deduct' ? 'text-fire-400' : 'text-obsidian-300')}>
                  {adj.type === 'deduct' ? '−' : '+'}{fmt.currency(adj.amount)}
                </span>
                <button onClick={() => removeCustomAdj(adj.id)} className="text-obsidian-600 hover:text-fire-500"><Minus className="h-3.5 w-3.5" /></button>
              </div>
            ))}

            {/* Add custom adjustment */}
            <div className="flex gap-2 pt-2">
              <input value={newAdjLabel} onChange={e => setNewAdjLabel(e.target.value)} placeholder="Label (e.g. Beer refund)" className="d-input flex-1 h-8 text-xs" />
              <input type="number" step="0.01" value={newAdjAmount} onChange={e => setNewAdjAmount(e.target.value)} placeholder="Amount" className="d-input w-24 h-8 text-xs mono" />
              <select value={newAdjType} onChange={e => setNewAdjType(e.target.value as any)} className="d-select w-24 h-8 text-xs">
                <option value="deduct">Deduct</option>
                <option value="add">Add</option>
              </select>
              <button onClick={addCustomAdj} className="btn-ghost h-8 px-3 text-xs"><Plus className="h-3.5 w-3.5" />Add</button>
            </div>

            {/* Net total */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-fire-900/30 border border-fire-800/50 px-4 py-3">
              <span className="font-bold text-white text-base">NET SALES</span>
              <span className={cn('mono text-xl font-bold', netSales >= 0 ? 'text-fire-gradient' : 'text-fire-400')}>{fmt.currency(netSales)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart */}
          <div className="d-card p-5">
            <h3 className="font-semibold text-white mb-4">Revenue Over Time</h3>
            {loading ? <div className="h-48 animate-pulse bg-obsidian-900 rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a1a1a" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525e' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#52525e' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="revenue" fill="#c0392b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By vendor */}
          <div className="d-card p-5">
            <h3 className="font-semibold text-white mb-4">Sales by Company</h3>
            {vendorMap.size === 0 ? <p className="text-sm text-obsidian-500">No sales yet.</p> : (
              <div className="space-y-2.5">
                {[...vendorMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([name, v]) => {
                  const vc = VENDOR_COMPANIES.find(x => x.name === name || x.id === name.toLowerCase());
                  return (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{vc?.emoji ?? '⚪'}</span>
                        <div>
                          <p className="text-sm font-medium text-white">{name}</p>
                          <p className="text-xs text-obsidian-500">{v.qty} units · profit {fmt.currency(v.profit)}</p>
                        </div>
                      </div>
                      <span className="mono text-sm font-bold text-fire-400">{fmt.currency(v.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Best selling products */}
        <div className="d-card overflow-hidden">
          <div className="border-b border-dragon-border px-5 py-3.5">
            <h3 className="font-semibold text-white">Best Selling Products</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-obsidian-900/50">
                <tr>
                  {['#', 'Product', 'Units', 'Revenue', 'Profit', 'Margin'].map(h => (
                    <th key={h} className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-obsidian-500', ['Units', 'Revenue', 'Profit', 'Margin'].includes(h) ? 'text-right' : '')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dragon-border">
                {loading && <tr><td colSpan={6} className="py-8 text-center text-obsidian-500">Loading…</td></tr>}
                {!loading && topProducts.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-obsidian-500">No sales in this period.</td></tr>}
                {topProducts.map((p, i) => (
                  <tr key={p.name} className="hover:bg-obsidian-900/30 transition-colors">
                    <td className="px-4 py-3 text-obsidian-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="mono px-4 py-3 text-right text-obsidian-300">{p.qty}</td>
                    <td className="mono px-4 py-3 text-right text-fire-400">{fmt.currency(p.revenue)}</td>
                    <td className="mono px-4 py-3 text-right text-gold-400">{fmt.currency(p.profit)}</td>
                    <td className="mono px-4 py-3 text-right text-obsidian-400">{p.revenue > 0 ? fmt.percent(p.profit / p.revenue * 100) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By employee */}
        <div className="d-card p-5">
          <h3 className="font-semibold text-white mb-4">Sales by Cashier</h3>
          {empMap.size === 0 ? <p className="text-sm text-obsidian-500">No sales.</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...empMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([name, v]) => (
                <div key={name} className="d-card p-4">
                  <p className="text-sm font-medium text-white">{name}</p>
                  <p className="mono text-lg font-bold text-fire-400 mt-1">{fmt.currency(v.revenue)}</p>
                  <p className="text-xs text-obsidian-500">{v.count} sales</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
