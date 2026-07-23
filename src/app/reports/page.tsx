'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3, Calendar, DollarSign, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { ClientOnly } from '@/components/ui/client-only';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

type Tab = 'today' | 'week' | 'month' | 'calendar';

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('week');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calDate, setCalDate] = useState(new Date());
  const [searchDate, setSearchDate] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const { data } = await sb.from('daily_reports').select('*').eq('store_id', store.id).gte('report_date', ninetyDaysAgo).order('report_date', { ascending: false });
    setReports(data ?? []);
    setLoading(false); setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;

  const n = (v: any) => Number(v || 0);
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const todayRpt   = reports.find(r => r.report_date === today);
  const weekRpts   = reports.filter(r => r.report_date >= weekAgo);
  const monthRpts  = reports.filter(r => r.report_date >= monthAgo);

  const sum = (rpts: any[], field: string) => rpts.reduce((s, r) => s + n(r[field]), 0);
  const avg = (rpts: any[], field: string) => rpts.length ? sum(rpts, field) / rpts.length : 0;

  // Chart data - last 30 days sorted ascending for chart
  const chartData = [...monthRpts].reverse().map(r => ({
    date: (() => { try { return new Date(r.report_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return r.report_date; } })(),
    sales: n(r.gross_sales),
    cash: n(r.cash_sales),
    credit: n(r.credit_sales),
    fuel: n(r.fuel_sales),
    lottery: n(r.lottery_sales),
    short_over: n(r.drawer_difference),
  }));

  // Best and worst days
  const sortedByS = [...monthRpts].sort((a, b) => n(b.gross_sales) - n(a.gross_sales));
  const bestDay  = sortedByS[0];
  const worstDay = sortedByS[sortedByS.length - 1];

  // Calendar month
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calMonthStr = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const StatCard = ({ label, value, sub, color = '' }: any) => (
    <div className="tile p-4 text-center">
      <p className="text-xs text-muted font-medium mb-1">{label}</p>
      <p className={cn('num font-black text-xl', color)}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );

  const TABS = [
    { id: 'today' as Tab, label: 'Today' },
    { id: 'week' as Tab,  label: '7 Days' },
    { id: 'month' as Tab, label: '30 Days' },
    { id: 'calendar' as Tab, label: '📅 Cal' },
  ];

  const searchResult = searchDate ? reports.find(r => r.report_date === searchDate) : null;

  return (
    <Screen title="Reports & P&L" subtitle="Sales analytics and trends"
      action={<button onClick={() => { setRefreshing(true); load(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub"><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></button>}>
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="inp h-9 text-sm flex-1" />
          {searchDate && <button onClick={() => setSearchDate('')} className="btn btn-ghost h-9 px-3 text-sm">Clear</button>}
        </div>
        {searchDate && (
          <div className="tile p-5">
            {searchResult ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">{(() => { try { return new Date(searchDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); } catch { return searchDate; } })()}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="tile p-3 text-center"><p className="text-xs text-muted">Gross Sales</p><p className="num font-black text-text">{fmt.currency(n(searchResult.gross_sales))}</p></div>
                  <div className="tile p-3 text-center"><p className="text-xs text-muted">Short/Over</p><p className={cn("num font-black", n(searchResult.drawer_difference)<0?"text-red-600":"text-green-600")}>{n(searchResult.drawer_difference)>=0?'+':''}{fmt.currency(n(searchResult.drawer_difference))}</p></div>
                  <div className="tile p-3 text-center"><p className="text-xs text-muted">Fuel</p><p className="num font-bold text-text">{fmt.currency(n(searchResult.fuel_sales))}</p></div>
                  <div className="tile p-3 text-center"><p className="text-xs text-muted">Cash</p><p className="num font-bold text-text">{fmt.currency(n(searchResult.cash_sales))}</p></div>
                </div>
              </div>
            ) : <p className="text-center text-gray-500 py-4">No report found for {searchDate}</p>}
          </div>
        )}
        {loading && <div className="tile p-10 text-center"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}

        {/* ── TODAY ── */}
        {!loading && tab === 'today' && (
          <>
            {!todayRpt ? (
              <div className="tile p-10 text-center"><BarChart3 className="h-10 w-10 text-dim mx-auto mb-3" /><p className="font-bold text-gray-300">No report uploaded today</p><p className="text-muted text-sm mt-1">Upload your daily close report to see today's numbers</p></div>
            ) : (
              <>
                <div className="tile p-6 text-center">
                  <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">Today's Gross Sales</p>
                  <p className="num text-5xl font-black text-text">{fmt.currency(n(todayRpt.gross_sales))}</p>
                  <div className={cn('flex items-center justify-center gap-1.5 mt-3 text-sm font-semibold', n(todayRpt.drawer_difference) < 0 ? 'text-red-600' : 'text-green-600')}>
                    <span>{n(todayRpt.drawer_difference) < -0.5 ? '⚠' : '✓'} Drawer: {n(todayRpt.drawer_difference) >= 0 ? '+' : ''}{fmt.currency(n(todayRpt.drawer_difference))}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Net Sales"    value={fmt.currency(n(todayRpt.net_sales))} />
                  <StatCard label="Fuel Sales"   value={fmt.currency(n(todayRpt.fuel_sales))} />
                  <StatCard label="Lottery"      value={fmt.currency(n(todayRpt.lottery_sales))} />
                  <StatCard label="Taxes"        value={fmt.currency(n(todayRpt.taxes))} />
                  <StatCard label="Cash"         value={fmt.currency(n(todayRpt.cash_sales))} />
                  <StatCard label="Credit"       value={fmt.currency(n(todayRpt.credit_sales))} />
                  <StatCard label="EBT"          value={fmt.currency(n(todayRpt.ebt_sales))} />
                  <StatCard label="Transactions" value={n(todayRpt.transactions) || '—'} />
                </div>
              </>
            )}
          </>
        )}

        {/* ── WEEK / MONTH ── */}
        {!loading && (tab === 'week' || tab === 'month') && (
          <>
            {(() => {
              const rpts = tab === 'week' ? weekRpts : monthRpts;
              const label = tab === 'week' ? '7-Day' : '30-Day';
              const totalSales = sum(rpts, 'gross_sales');
              const totalFuel = sum(rpts, 'fuel_sales');
              const totalLottery = sum(rpts, 'lottery_sales');
              const avgSales = avg(rpts, 'gross_sales');
              const totalShortOver = sum(rpts, 'drawer_difference');
              return (
                <>
                  <div className="tile p-5 text-center">
                    <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-2">{label} Total Sales</p>
                    <p className="num text-5xl font-black text-text">{fmt.currency(totalSales)}</p>
                    <p className="text-sm text-muted mt-2">{rpts.length} days reported · avg {fmt.currency(avgSales)}/day</p>
                    {totalShortOver !== 0 && (
                      <div className={cn('mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold', totalShortOver < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
                        {totalShortOver < 0 ? '⚠' : '✓'} {label} Short/Over: {totalShortOver >= 0 ? '+' : ''}{fmt.currency(totalShortOver)}
                      </div>
                    )}
                  </div>

                  {/* Bar chart */}
                  {chartData.length > 0 && (
                    <div className="tile p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Daily Sales</p>
                      <ClientOnly>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={tab === 'week' ? chartData.slice(-7) : chartData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-45} textAnchor="end" />
                            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} />
                            <Tooltip formatter={(v: any) => [fmt.currency(v), 'Sales']} labelStyle={{ fontSize: 12 }} />
                            <Bar dataKey="sales" fill="#C0392B" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ClientOnly>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Total Fuel"    value={fmt.currency(totalFuel)} />
                    <StatCard label="Total Lottery" value={fmt.currency(totalLottery)} />
                    <StatCard label="Avg Cash"      value={fmt.currency(avg(rpts, 'cash_sales'))} sub="per day" />
                    <StatCard label="Avg Credit"    value={fmt.currency(avg(rpts, 'credit_sales'))} sub="per day" />
                  </div>

                  {/* Best/worst */}
                  {bestDay && worstDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="tile p-4 border-l-4 border-l-green-500">
                        <div className="flex items-center gap-1.5 mb-2"><ArrowUpRight className="h-4 w-4 text-green-600" /><p className="text-xs font-bold text-green-800">Best Day</p></div>
                        <p className="num font-black text-text">{fmt.currency(n(bestDay.gross_sales))}</p>
                        <p className="text-xs text-muted mt-1">{(() => { try { return new Date(bestDay.report_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return bestDay.report_date; } })()}</p>
                      </div>
                      <div className="tile p-4 border-l-4 border-l-red-400">
                        <div className="flex items-center gap-1.5 mb-2"><ArrowDownRight className="h-4 w-4 text-red-600" /><p className="text-xs font-bold text-red-800">Worst Day</p></div>
                        <p className="num font-black text-text">{fmt.currency(n(worstDay.gross_sales))}</p>
                        <p className="text-xs text-muted mt-1">{(() => { try { return new Date(worstDay.report_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return worstDay.report_date; } })()}</p>
                      </div>
                    </div>
                  )}

                  {/* Report list */}
                  <div className="tile overflow-hidden">
                    <div className="px-5 py-3 border-b border-border"><p className="text-xs font-bold uppercase tracking-wide text-muted">Daily Breakdown</p></div>
                    {rpts.slice(0, 14).map(r => (
                      <div key={r.id} className="px-5 py-3.5 flex items-center justify-between border-b border-border/50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-text">{(() => { try { return new Date(r.report_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return r.report_date; } })()}</p>
                          <p className="text-xs text-muted">Cash: {fmt.currency(n(r.cash_sales))} · Credit: {fmt.currency(n(r.credit_sales))}</p>
                        </div>
                        <div className="text-right">
                          <p className="num font-bold text-text">{fmt.currency(n(r.gross_sales))}</p>
                          {n(r.drawer_difference) !== 0 && (
                            <p className={cn('num text-xs font-bold', n(r.drawer_difference) < 0 ? 'text-red-600' : 'text-green-600')}>
                              {n(r.drawer_difference) >= 0 ? '+' : ''}{fmt.currency(n(r.drawer_difference))}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </>
        )}

        {/* ── CALENDAR ── */}
        {!loading && tab === 'calendar' && (
          <>
            <div className="tile p-5">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-text"><ChevronLeft className="h-5 w-5" /></button>
                <p className="font-bold text-text">{calMonthStr}</p>
                <button onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-text"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <p key={d} className="text-[10px] text-muted font-bold text-center">{d}</p>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const d = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const rpt = reports.find(r => r.report_date === dateStr);
                  const isToday = dateStr === today;
                  return (
                    <div key={d} className={cn('rounded-xl p-1.5 text-center min-h-12 flex flex-col items-center justify-center',
                      isToday ? 'ring-2 ring-accent' : '',
                      rpt ? 'bg-green-50 border border-green-200' : 'bg-surface border border-border/30')}>
                      <p className={cn('text-xs font-bold', isToday ? 'text-accent' : rpt ? 'text-green-800' : 'text-muted')}>{d}</p>
                      {rpt && <p className="num text-[9px] font-bold text-green-700 leading-none mt-0.5">{fmt.currency(n(rpt.gross_sales)).replace('$', '$').split('.')[0]}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="tile p-4">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-green-200 border border-green-300" /><span className="text-muted">Report uploaded</span></div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded ring-2 ring-accent bg-surface" /><span className="text-muted">Today</span></div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-surface border border-border/30" /><span className="text-muted">No report</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
