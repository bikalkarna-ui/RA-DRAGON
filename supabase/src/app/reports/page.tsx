'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { ClientOnly } from '@/components/ui/client-only';
import { TrendingUp, TrendingDown, DollarSign, Zap, BarChart3, Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

type Tab = 'pl' | 'trend' | 'calendar';


// Safe date formatter - never crashes on null/undefined dates

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('pl');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calDate, setCalDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<any>(null);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const from = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    const { data } = await createClient()
      .from('daily_close_reports').select('*')
      .eq('store_id', store.id)
      .gte('report_date', from)
      .order('report_date', { ascending: false });
    setReports(data ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  const n = (v: any) => Number(v || 0);

  // 30-day totals
  const totalGross   = reports.reduce((s, r) => s + n(r.total_sales), 0);
  const totalPayouts = reports.reduce((s, r) => s + n(r.total_out), 0);
  const totalNet     = reports.reduce((s, r) => s + n(r.net), 0);
  const totalDeposit = reports.reduce((s, r) => s + n(r.total_deposit), 0);
  const avgDaily     = reports.length > 0 ? totalGross / reports.length : 0;
  const bestDay      = reports.reduce((best, r) => n(r.total_sales) > n(best?.total_sales ?? 0) ? r : best, reports[0]);
  const worstDay     = reports.filter(r => n(r.total_sales) > 0).reduce((worst, r) => n(r.total_sales) < n(worst?.total_sales ?? 999999) ? r : worst, reports[reports.length - 1]);

  // Short/over summary
  const totalShortOver = reports.reduce((s, r) => s + n(r.short_over), 0);
  const shortDays   = reports.filter(r => n(r.short_over) < -1).length;
  const overDays    = reports.filter(r => n(r.short_over) > 1).length;

  // Chart data - last 14 days
  const chartData = [...reports].reverse().slice(-14).map(r => ({
    date: (r.report_date + 'T12:00:00' ? (() => { try { return (() => { try { const __d = new Date(r.report_date + 'T12:00:00'); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—'),
    sales: n(r.total_sales),
    net: n(r.net),
    short: n(r.short_over),
  }));

  // Dept totals across 30 days
  const deptTotals = [
    { label: 'CIG / Tobacco',  key: 'dept_cig'         },
    { label: 'Beer & Wine',    key: 'dept_beer_wine'    },
    { label: 'Tax Items',      key: 'dept_tax'          },
    { label: 'Non-Tax',        key: 'dept_nontax'       },
    { label: 'Vape',           key: 'dept_vape'         },
    { label: 'Novelty',        key: 'dept_novelty'      },
    { label: 'Lotto',          key: 'lotto_sales'       },
    { label: 'Lottery',        key: 'lottery_sales'     },
    { label: 'Fuel Unleaded',  key: 'fuel_unleaded'     },
    { label: 'Fuel Diesel',    key: 'fuel_diesel'       },
    { label: 'Money Orders',   key: 'money_order_sales' },
  ].map(d => ({
    ...d,
    total: reports.reduce((s, r) => s + n(r[d.key]), 0),
    avg: reports.length > 0 ? reports.reduce((s, r) => s + n(r[d.key]), 0) / reports.length : 0,
  })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

  // AI Recommendations
  const recommendations: { type: 'good' | 'warn' | 'alert'; text: string }[] = [];
  if (shortDays > 3) recommendations.push({ type: 'alert', text: `Drawer was short ${shortDays} days this month — check your cashiers` });
  if (totalShortOver > 100) recommendations.push({ type: 'good', text: `Drawer is consistently over — double-check MAC/lotto payouts are being recorded` });
  if (avgDaily > 0 && chartData.length >= 2) {
    const lastWeekAvg = chartData.slice(-7).reduce((s, d) => s + d.sales, 0) / 7;
    const prevWeekAvg = chartData.slice(-14, -7).reduce((s, d) => s + d.sales, 0) / 7;
    if (lastWeekAvg > prevWeekAvg * 1.1) recommendations.push({ type: 'good', text: `Sales up ${((lastWeekAvg / prevWeekAvg - 1) * 100).toFixed(0)}% this week vs last week — great trend` });
    if (lastWeekAvg < prevWeekAvg * 0.9) recommendations.push({ type: 'warn', text: `Sales down ${((1 - lastWeekAvg / prevWeekAvg) * 100).toFixed(0)}% this week — check if any department dropped` });
  }
  if (deptTotals[0]) recommendations.push({ type: 'good', text: `${deptTotals[0].label} is your top revenue department — keep it stocked` });
  const unknownUPC = reports.reduce((s, r) => s + n(r.dept_unknown_upc), 0);
  if (unknownUPC > 500) recommendations.push({ type: 'warn', text: `${fmt.currency(unknownUPC)} in Unknown UPC sales — add these products to inventory` });

  // Calendar
  const reportsByDate = new Map(reports.map(r => [r.report_date, r]));
  const year = calDate.getFullYear(), month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const Tooltip_ = ({ active, payload, label }: any) =>
    active && payload?.length ? (
      <div className="tile px-3 py-2 text-xs shadow-lg">
        <p className="text-muted mb-1">{label}</p>
        {payload.map((p: any) => <p key={p.name} style={{ color: p.color }} className="font-bold">{p.name}: {fmt.currency(p.value)}</p>)}
      </div>
    ) : null;

  if (!mounted) return null;

  return (
    <Screen title="Reports & P&amp;L" subtitle="Last 30 days — auto-built from Modisoft uploads">
      <div className="space-y-5">

        {/* Upload another report */}
        <div className="tile p-4">
          <p className="text-xs font-bold text-muted mb-3 uppercase tracking-wide">Upload Today's Report</p>
          <MultiScan endpoint="/api/scan-till" onResult={load}
            title="Scan Modisoft Report" hint="Adds to today's data and updates all charts below" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'pl',       label: '💰 P&amp;L Summary' },
            { id: 'trend',    label: '📈 Trends'       },
            { id: 'calendar', label: '📅 Calendar'     },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── P&amp;L TAB ── */}
        {tab === 'pl' && (
          <div className="space-y-4">
            {/* 30-day headline numbers */}
            <div className="tile p-5 border-l-4 border-l-accent">
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Last 30 Days</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Total Revenue',   value: fmt.currency(totalGross),   green: true  },
                  { label: 'Net After Payouts', value: fmt.currency(totalNet),   green: totalNet >= 0 },
                  { label: 'Total Payouts',   value: fmt.currency(totalPayouts),  green: false },
                  { label: 'Total Deposited', value: fmt.currency(totalDeposit),  green: true  },
                  { label: 'Avg Daily Sales', value: fmt.currency(avgDaily),      green: true  },
                  { label: 'Days Reported',   value: `${reports.length} days`,    green: true  },
                ].map(k => (
                  <div key={k.label}>
                    <p className="text-xs text-muted">{k.label}</p>
                    <p className={cn('num font-black text-xl mt-0.5', k.green ? 'text-text' : 'text-accent')}>{k.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Short/Over summary */}
            <div className={cn('tile p-5 border-2',
              totalShortOver < -10 ? 'border-red-300 bg-red-50' : totalShortOver > 10 ? 'border-green-300 bg-green-50' : 'border-gray-200')}>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Cash Accuracy (30 days)</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('num text-3xl font-black', totalShortOver < 0 ? 'text-accent' : totalShortOver > 0 ? 'text-green-700' : 'text-gray-700')}>
                    {totalShortOver >= 0 ? '+' : ''}{fmt.currency(totalShortOver)}
                  </p>
                  <p className="text-xs text-muted mt-1">cumulative short/over</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm"><span className="num font-bold text-accent">{shortDays}</span> <span className="text-muted text-xs">days short</span></p>
                  <p className="text-sm"><span className="num font-bold text-green-600">{overDays}</span> <span className="text-muted text-xs">days over</span></p>
                  <p className="text-sm"><span className="num font-bold text-gray-600">{reports.length - shortDays - overDays}</span> <span className="text-muted text-xs">days exact</span></p>
                </div>
              </div>
            </div>

            {/* Best/Worst days */}
            {bestDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="tile p-4 border border-green-200 bg-green-50">
                  <div className="flex items-center gap-1.5 mb-2"><TrendingUp className="h-4 w-4 text-green-600" /><p className="text-xs text-green-700 font-bold">Best Day</p></div>
                  <p className="num text-xl font-black text-green-800">{fmt.currency(n(bestDay.total_sales))}</p>
                  <p className="text-xs text-green-600 mt-1">{(bestDay.report_date + 'T12:00:00' ? (() => { try { return (() => { try { const __d = new Date(bestDay.report_date + 'T12:00:00'); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—')}</p>
                </div>
                {worstDay && (
                  <div className="tile p-4 border border-red-100 bg-red-50">
                    <div className="flex items-center gap-1.5 mb-2"><TrendingDown className="h-4 w-4 text-accent" /><p className="text-xs text-accent font-bold">Slowest Day</p></div>
                    <p className="num text-xl font-black text-accent">{fmt.currency(n(worstDay.total_sales))}</p>
                    <p className="text-xs text-red-400 mt-1">{(worstDay.report_date + 'T12:00:00' ? (() => { try { return (() => { try { const __d = new Date(worstDay.report_date + 'T12:00:00'); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—')}</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div className="tile p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-violet-600" />
                  <p className="font-bold text-text">AI Recommendations</p>
                </div>
                <div className="space-y-2.5">
                  {recommendations.map((r, i) => (
                    <div key={i} className={cn('flex items-start gap-3 rounded-xl px-4 py-3',
                      r.type === 'good'  ? 'bg-green-50 border border-green-200' :
                      r.type === 'warn'  ? 'bg-amber-50 border border-amber-200' :
                      'bg-red-50 border border-red-200')}>
                      <span className="text-base shrink-0 mt-0.5">
                        {r.type === 'good' ? '✅' : r.type === 'warn' ? '⚠️' : '🚨'}
                      </span>
                      <p className={cn('text-sm font-medium',
                        r.type === 'good' ? 'text-green-800' : r.type === 'warn' ? 'text-amber-800' : 'text-red-800')}>
                        {r.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Department breakdown */}
            {deptTotals.length > 0 && (
              <div className="tile p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Revenue by Department (30 days)</p>
                <div className="space-y-3">
                  {deptTotals.map(dept => (
                    <div key={dept.label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-text">{dept.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted">avg {fmt.currency(dept.avg)}/day</span>
                          <span className="num text-sm font-bold text-text">{fmt.currency(dept.total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full"
                          style={{ width: `${totalGross > 0 ? (dept.total / totalGross * 100) : 0}%`, opacity: 0.7 + (dept.total / deptTotals[0].total) * 0.3 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reports.length === 0 && !loading && (
              <div className="tile p-10 text-center">
                <BarChart3 className="h-10 w-10 text-dim mx-auto mb-3" />
                <p className="font-bold text-text mb-1">No data yet</p>
                <p className="text-muted text-sm">Upload your Modisoft daily reports and all your P&amp;L numbers will appear here automatically</p>
              </div>
            )}
          </div>
        )}

        {/* ── TREND TAB ── */}
        {tab === 'trend' && (
          <div className="space-y-4">
            {chartData.length > 0 ? (
              <>
                <div className="tile p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Daily Sales — Last 14 Days</p>
                  <ClientOnly><ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<Tooltip_ />} />
                      <Bar dataKey="sales" name="Sales" fill="#C0392B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer></ClientOnly>
                </div>

                <div className="tile p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Short / Over — Last 14 Days</p>
                  <ClientOnly><ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tooltip_ />} />
                      <Bar dataKey="short" name="Short/Over"
                        fill="#C0392B"
                        radius={[3, 3, 0, 0]}
                        label={{ position: 'top', fontSize: 9, fill: '#9CA3AF', formatter: (v: number) => v !== 0 ? fmt.currency(v) : '' }} />
                    </BarChart>
                  </ResponsiveContainer></ClientOnly>
                </div>

                {/* Daily history table */}
                <div className="tile overflow-hidden">
                  <div className="border-b border-border px-5 py-3.5">
                    <p className="font-bold text-text text-sm">Daily History</p>
                  </div>
                  <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
                    {reports.map(r => (
                      <div key={r.report_date} className="flex items-center justify-between px-5 py-3 hover:bg-surface">
                        <div>
                          <p className="text-sm font-semibold text-text">{(r.report_date + 'T12:00:00' ? (() => { try { return (() => { try { const __d = new Date(r.report_date + 'T12:00:00'); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—')}</p>
                          <p className="text-xs text-muted">Deposit: {fmt.currency(n(r.total_deposit))}</p>
                        </div>
                        <div className="text-right">
                          <p className="num font-black text-text">{fmt.currency(n(r.total_sales))}</p>
                          <span className={cn('chip text-[10px]',
                            n(r.short_over) === 0 ? 'chip-gray' : n(r.short_over) < 0 ? 'chip-red' : 'chip-green')}>
                            {n(r.short_over) >= 0 ? '+' : ''}{fmt.currency(n(r.short_over))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="tile p-10 text-center">
                <p className="text-muted">Upload at least 2 days of reports to see trends</p>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR TAB ── */}
        {tab === 'calendar' && (
          <div className="tile p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-surface">
                <ChevronLeft className="h-5 w-5 text-sub" />
              </button>
              <p className="font-black text-text">{calDate.toLocaleDateString('en-US', {month:'long', year:'numeric'})}</p>
              <button onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-surface">
                <ChevronRight className="h-5 w-5 text-sub" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S','M','T','W','T','F','S'].map((d, i) => <p key={i} className="text-center text-xs text-muted font-medium py-1">{d}</p>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day     = i + 1;
                const dateStr = (() => { try { const __d = new Date(year, month, day); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })();
                const rpt     = reportsByDate.get(dateStr);
                const isToday = dateStr === '—';
                const isSelected = selectedDay?.report_date === dateStr;
                return (
                  <button key={day} onClick={() => setSelectedDay(isSelected ? null : rpt ?? null)}
                    disabled={!rpt}
                    className={cn('rounded-xl p-1.5 text-center transition-all',
                      isSelected     ? 'bg-accent' :
                      isToday        ? 'border-2 border-accent' :
                      rpt            ? 'bg-surface hover:bg-border cursor-pointer' :
                      'opacity-30 cursor-default')}>
                    <p className={cn('text-xs font-black', isSelected ? 'text-white' : isToday ? 'text-accent' : 'text-text')}>{day}</p>
                    {rpt && !isSelected && <p className="text-[9px] text-green-600 num leading-none">{fmt.currency(n(rpt.total_sales)).replace('$','')}</p>}
                    {rpt && !isSelected && n(rpt.short_over) < -1 && <div className="h-1 w-1 rounded-full bg-accent mx-auto mt-0.5" />}
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="mt-5 border-t border-border pt-4 space-y-3 animate-fade-up">
                <p className="font-black text-text">{(selectedDay.report_date + 'T12:00:00' ? (() => { try { return (() => { try { const __d = new Date(selectedDay.report_date + 'T12:00:00'); if(isNaN(__d.getTime())) return '—'; return __d.toLocaleDateString('en-US', {month:'short',day:'numeric'}); } catch { return '—'; } })(); } catch { return '—'; } })() : '—')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { l: 'Total Sales',   v: fmt.currency(n(selectedDay.total_sales)) },
                    { l: 'Net',           v: fmt.currency(n(selectedDay.net))          },
                    { l: 'Short/Over',    v: `${n(selectedDay.short_over) >= 0 ? '+' : ''}${fmt.currency(n(selectedDay.short_over))}` },
                    { l: 'Cash Deposit',  v: fmt.currency(n(selectedDay.total_deposit)) },
                    { l: 'Credit Card',   v: fmt.currency(n(selectedDay.credit_card_total)) },
                    { l: 'Payouts',       v: fmt.currency(n(selectedDay.total_out))   },
                  ].map(k => (
                    <div key={k.l} className="bg-surface rounded-xl p-3 text-center">
                      <p className="text-[10px] text-muted font-medium">{k.l}</p>
                      <p className="num font-black text-text text-sm mt-0.5">{k.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
