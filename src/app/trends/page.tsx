'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { ClientOnly } from '@/components/ui/client-only';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function TrendsPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    const { data } = await createClient().from('daily_reports').select('report_date,gross_sales,fuel_sales,inside_sales,taxes,cash_sales,credit_sales,drawer_difference')
      .eq('store_id', store.id).gte('report_date', yearAgo).order('report_date');
    setReports(data || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);

  // Group by month
  const byMonth: Record<string, any[]> = {};
  reports.forEach(r => {
    const m = r.report_date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  });

  const monthlyData = Object.entries(byMonth).map(([month, rpts]) => ({
    month: (() => { try { return new Date(month+'-15').toLocaleDateString('en-US',{month:'short',year:'2-digit'}); } catch { return month; } })(),
    sales: Math.round(rpts.reduce((s,r)=>s+n(r.gross_sales),0)),
    fuel: Math.round(rpts.reduce((s,r)=>s+n(r.fuel_sales),0)),
    inside: Math.round(rpts.reduce((s,r)=>s+n(r.inside_sales),0)),
    days: rpts.length,
  })).slice(-12);

  // Week over week comparison
  const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekStart = new Date(); lastWeekStart.setDate(lastWeekStart.getDate() - 14);
  const thisWeek = reports.filter(r => r.report_date >= thisWeekStart.toISOString().split('T')[0]);
  const lastWeek = reports.filter(r => r.report_date >= lastWeekStart.toISOString().split('T')[0] && r.report_date < thisWeekStart.toISOString().split('T')[0]);

  const tw = thisWeek.reduce((s,r)=>s+n(r.gross_sales),0);
  const lw = lastWeek.reduce((s,r)=>s+n(r.gross_sales),0);
  const wowChg = lw > 0 ? ((tw-lw)/lw*100) : 0;

  const totalSales = reports.reduce((s,r)=>s+n(r.gross_sales),0);
  const avgDaily = reports.length > 0 ? totalSales/reports.length : 0;
  const bestDay = [...reports].sort((a,b)=>n(b.gross_sales)-n(a.gross_sales))[0];
  const worstDay = [...reports].sort((a,b)=>n(a.gross_sales)-n(b.gross_sales))[0];

  return (
    <Screen title="Annual Trends" subtitle="12-month performance overview">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">12-Month Total</p>
            <p className="num font-black text-xl text-text">{fmt.currency(totalSales)}</p>
          </div>
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">Avg Daily</p>
            <p className="num font-black text-xl text-text">{fmt.currency(avgDaily)}</p>
          </div>
        </div>

        {/* Week over week */}
        <div className={cn('tile p-5 border-l-4', wowChg >= 0 ? 'border-l-green-500' : 'border-l-red-500')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted font-semibold uppercase tracking-wide">Week vs Last Week</p>
              <p className="num font-black text-3xl text-text mt-1">{fmt.currency(tw)}</p>
              <p className="text-xs text-muted mt-1">vs {fmt.currency(lw)} last week</p>
            </div>
            <div className={cn('flex items-center gap-1.5 text-lg font-black', wowChg >= 0 ? 'text-green-600' : 'text-red-600')}>
              {wowChg >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              {wowChg >= 0 ? '+' : ''}{wowChg.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Chart */}
        {monthlyData.length > 0 && (
          <div className="tile p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Monthly Sales</p>
            <ClientOnly>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-45} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => '$'+(v/1000).toFixed(0)+'k'} />
                  <Tooltip formatter={(v: any) => [fmt.currency(v), 'Sales']} />
                  <Bar dataKey="sales" fill="#C0392B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        )}

        {/* Best/worst */}
        {bestDay && (
          <div className="grid grid-cols-2 gap-3">
            <div className="tile p-4 border-l-4 border-l-green-500">
              <p className="text-xs font-bold text-green-700 mb-1">🏆 Best Day</p>
              <p className="num font-black text-text">{fmt.currency(n(bestDay.gross_sales))}</p>
              <p className="text-xs text-muted">{bestDay.report_date}</p>
            </div>
            {worstDay && (
              <div className="tile p-4 border-l-4 border-l-red-400">
                <p className="text-xs font-bold text-red-700 mb-1">📉 Lowest Day</p>
                <p className="num font-black text-text">{fmt.currency(n(worstDay.gross_sales))}</p>
                <p className="text-xs text-muted">{worstDay.report_date}</p>
              </div>
            )}
          </div>
        )}

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}
      </div>
    </Screen>
  );
}
