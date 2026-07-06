'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { RefreshCw, TrendingUp, Fuel } from 'lucide-react';

const GRADES = [
  { key: 'unleaded', label: 'Unleaded', sales_col: 'fuel_unleaded_sales', gal_col: 'fuel_unleaded_gallons', color: 'text-green-700 bg-green-50' },
  { key: 'midgrade', label: 'Midgrade', sales_col: 'fuel_midgrade_sales', gal_col: 'fuel_midgrade_gallons', color: 'text-blue-700 bg-blue-50' },
  { key: 'premium',  label: 'Premium',  sales_col: 'fuel_premium_sales',  gal_col: 'fuel_premium_gallons',  color: 'text-purple-700 bg-purple-50' },
  { key: 'diesel',   label: 'Diesel',   sales_col: 'fuel_diesel_sales',   gal_col: 'fuel_diesel_gallons',   color: 'text-amber-700 bg-amber-50' },
];

export default function FuelPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [costs, setCosts] = useState<Record<string, string>>({ unleaded: '', midgrade: '', premium: '', diesel: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('daily_reports').select('*').eq('store_id', store.id)
      .gte('report_date', new Date(Date.now()-30*86400000).toISOString().split('T')[0])
      .order('report_date', { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);

  const totals = GRADES.map(g => {
    const totalSales = reports.reduce((s, r) => s + n(r[g.sales_col]), 0);
    const totalGal   = reports.reduce((s, r) => s + n(r[g.gal_col]), 0);
    const avgPrice   = totalGal > 0 ? totalSales / totalGal : 0;
    const cost       = parseFloat(costs[g.key]) || 0;
    const margin     = cost > 0 && avgPrice > 0 ? avgPrice - cost : 0;
    const marginPct  = avgPrice > 0 && margin > 0 ? (margin / avgPrice * 100) : 0;
    return { ...g, totalSales, totalGal, avgPrice, cost, margin, marginPct };
  }).filter(g => g.totalSales > 0);

  const totalFuelSales  = totals.reduce((s, g) => s + g.totalSales, 0);
  const totalFuelGal    = totals.reduce((s, g) => s + g.totalGal, 0);
  const avgFuelMargin   = totals.reduce((s, g) => s + g.margin * g.totalGal, 0) / Math.max(1, totalFuelGal);

  return (
    <Screen title="Fuel Margin Tracker" subtitle="Street price vs cost per gallon">
      <div className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">30-Day Fuel Sales</p>
            <p className="num font-black text-xl text-text">{fmt.currency(totalFuelSales)}</p>
          </div>
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">Total Gallons</p>
            <p className="num font-black text-xl text-text">{totalFuelGal.toFixed(0)}</p>
          </div>
        </div>

        {/* Cost input */}
        <div className="tile p-5">
          <p className="text-sm font-bold text-text mb-3">Enter your cost per gallon</p>
          <p className="text-xs text-muted mb-4">What you pay your fuel supplier — used to calculate your margin</p>
          <div className="space-y-3">
            {GRADES.map(g => (
              <div key={g.key} className="flex items-center gap-3">
                <span className={cn('rounded-lg px-3 py-1.5 text-xs font-bold w-20 text-center', g.color)}>{g.label}</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input type="number" step="0.001" min="0" placeholder="0.000"
                    value={costs[g.key]}
                    onChange={e => setCosts(p => ({ ...p, [g.key]: e.target.value }))}
                    className="inp pl-7 num" />
                </div>
                <span className="text-xs text-muted">/gal</span>
              </div>
            ))}
          </div>
        </div>

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {/* Per grade breakdown */}
        {totals.map(g => (
          <div key={g.key} className="tile p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={cn('rounded-lg px-3 py-1.5 text-xs font-bold', g.color)}>{g.label}</span>
              {g.margin > 0 && <span className="num font-black text-green-700">{fmt.currency(g.margin)}/gal margin</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Sales</p>
                <p className="num font-bold text-text text-sm">{fmt.currency(g.totalSales)}</p>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Gallons</p>
                <p className="num font-bold text-text text-sm">{g.totalGal.toFixed(1)}</p>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Avg Price</p>
                <p className="num font-bold text-text text-sm">{g.avgPrice > 0 ? fmt.currency(g.avgPrice) : '—'}</p>
              </div>
            </div>
            {g.cost > 0 && g.avgPrice > 0 && (
              <div className={cn('mt-3 rounded-xl p-3 flex justify-between', g.margin > 0 ? 'bg-green-50' : 'bg-red-50')}>
                <span className="text-sm font-semibold">Net Margin</span>
                <span className={cn('num font-black', g.margin > 0 ? 'text-green-700' : 'text-red-700')}>
                  {fmt.currency(g.margin)}/gal ({g.marginPct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}
