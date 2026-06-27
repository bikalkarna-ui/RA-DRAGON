'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { BarChart3, Clock, RefreshCw, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function DailyReportPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [report, setReport] = useState<any>(null);
  const [tillCount, setTillCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [yesterday, setYesterday] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const today = new Date().toISOString().split('T')[0];
    const yday = subDays(new Date(), 1).toISOString().split('T')[0];
    const [{ data: rpt }, { data: tills }, { data: yRpt }] = await Promise.all([
      sb.from('daily_close_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
      sb.from('till_readings').select('id').eq('store_id', store.id).eq('reading_date', today),
      sb.from('daily_close_reports').select('total_sales').eq('store_id', store.id).eq('report_date', yday).maybeSingle(),
    ]);
    // Only show report if there are actual till readings for today
    setReport(tills && tills.length > 0 ? rpt : null);
    setTillCount((tills ?? []).length);
    setYesterday(yRpt);
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) loadData(); }, [mounted, store, loadData]);

  if (!mounted) return null;

  const handleUpload = (data: any) => {
    if (data.report) setReport(data.report);
    setTillCount(data.tillCount ?? 1);
    loadData();
  };

  const n = (v: any) => Number(v || 0);
  const gross = n(report?.total_sales);
  const shortOver = n(report?.short_over);
  const vsYesterday = yesterday && n(yesterday.total_sales) > 0
    ? ((gross - n(yesterday.total_sales)) / n(yesterday.total_sales) * 100) : null;

  const depts = report ? [
    { label: 'Tobacco / CIG',  value: n(report.dept_cig) },
    { label: 'Beer & Wine',    value: n(report.dept_beer_wine) },
    { label: 'Tax Items',      value: n(report.dept_tax) },
    { label: 'Non-Tax Items',  value: n(report.dept_nontax) },
    { label: 'Novelty',        value: n(report.dept_novelty) },
    { label: 'Vape',           value: n(report.dept_vape) },
    { label: 'Unknown UPC',    value: n(report.dept_unknown_upc) },
    { label: 'Lotto Sales',    value: n(report.lotto_sales) },
    { label: 'Lottery Sales',  value: n(report.lottery_sales) },
    { label: 'Fuel Unleaded',  value: n(report.fuel_unleaded) },
    { label: 'Fuel Midgrade',  value: n(report.fuel_midgrade) },
    { label: 'Fuel Diesel',    value: n(report.fuel_diesel) },
    { label: 'Money Orders',   value: n(report.money_order_sales) + n(report.money_order_fee) },
  ].filter(d => d.value > 0).sort((a, b) => b.value - a.value) : [];

  return (
    <Screen title="Daily Report" subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      action={
        <button onClick={() => { setRefreshing(true); loadData(); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      }>
      <div className="space-y-5">

        {/* Upload section */}
        <div className="tile p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-bold text-text">Upload Modisoft Report</p>
              <p className="text-xs text-muted mt-0.5">Modisoft → Reports → Daily Sales Summary → screenshot or PDF → upload here</p>
            </div>
          </div>
          <MultiScan
            endpoint="/api/scan-till"
            onResult={handleUpload}
            title="Scan or Upload Daily Report"
            hint="Photo or PDF of your Modisoft report — AI reads all numbers in seconds"
          />
          {tillCount > 0 && (
            <p className="mt-3 text-xs text-green-700 font-medium bg-green-50 rounded-xl px-3 py-2">
              ✓ {tillCount} report{tillCount > 1 ? 's' : ''} uploaded today
            </p>
          )}
        </div>

        {loading && (
          <div className="tile p-10 text-center">
            <RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" />
          </div>
        )}

        {/* No report yet */}
        {!loading && !report && (
          <div className="tile p-10 text-center border-2 border-dashed border-gray-200">
            <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="font-bold text-gray-700 mb-1">No report uploaded today</p>
            <p className="text-gray-400 text-sm">Upload your Modisoft report above and your numbers will appear here</p>
          </div>
        )}

        {/* Report data */}
        {report && (
          <>
            {/* Total sales */}
            <div className="tile p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wide mb-1">Total Sales Today</p>
                <p className="num text-4xl font-black text-text">{fmt.currency(gross)}</p>
                {vsYesterday !== null && (
                  <div className={cn('flex items-center gap-1 mt-1.5 text-xs font-semibold', vsYesterday >= 0 ? 'text-green-600' : 'text-accent')}>
                    {vsYesterday >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {Math.abs(vsYesterday).toFixed(1)}% vs yesterday ({fmt.currency(n(yesterday?.total_sales))})
                  </div>
                )}
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <DollarSign className="h-7 w-7 text-accent" />
              </div>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn('tile p-4 border-2', shortOver < 0 ? 'border-red-300 bg-red-50' : shortOver > 0 ? 'border-green-300 bg-green-50' : 'border-gray-200')}>
                <p className="text-xs text-muted font-medium mb-1">Short / Over</p>
                <p className={cn('num text-2xl font-black', shortOver < 0 ? 'text-accent' : shortOver > 0 ? 'text-green-700' : 'text-gray-700')}>
                  {shortOver > 0 ? '+' : ''}{fmt.currency(shortOver)}
                </p>
                <p className="text-xs text-muted mt-1">{shortOver === 0 ? 'Exact ✓' : shortOver < 0 ? 'Drawer short' : 'Drawer over'}</p>
              </div>
              <div className="tile p-4">
                <p className="text-xs text-muted font-medium mb-1">Cash to Deposit</p>
                <p className="num text-2xl font-black text-text">{fmt.currency(n(report.cash_actual))}</p>
                <p className="text-xs text-muted mt-1">Expected: {fmt.currency(n(report.cash_expected))}</p>
              </div>
              <div className="tile p-4">
                <p className="text-xs text-muted font-medium mb-1">Credit / Debit</p>
                <p className="num text-2xl font-black text-text">{fmt.currency(n(report.credit_card_total))}</p>
              </div>
              <div className="tile p-4">
                <p className="text-xs text-muted font-medium mb-1">Total Payouts</p>
                <p className="num text-2xl font-black text-accent">{fmt.currency(n(report.total_out))}</p>
              </div>
            </div>

            {/* Cash flow */}
            <div className="tile p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Cash Flow</p>
              <div className="space-y-2">
                {[
                  { label: 'Cash Sales',    value: n(report.total_cash_flow) - n(report.credit_card_total) - n(report.ebt_total), pos: true },
                  { label: 'Credit Card',   value: n(report.credit_card_total), pos: true },
                  { label: 'EBT / SNAP',    value: n(report.ebt_total), pos: true },
                  { label: 'ATM / MAC In',  value: n(report.mac_in), pos: true },
                  { label: 'Lotto Paid',    value: n(report.lotto_paid), pos: false },
                  { label: 'Lottery Paid',  value: n(report.lottery_paid), pos: false },
                  { label: 'MAC Payout',    value: n(report.mac_payout), pos: false },
                  { label: 'Purchase Paid', value: n(report.purchase_paid), pos: false },
                ].filter(r => r.value > 0).map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2 w-2 rounded-full', row.pos ? 'bg-green-400' : 'bg-red-400')} />
                      <span className="text-sm text-gray-700">{row.label}</span>
                    </div>
                    <span className={cn('num text-sm font-bold', row.pos ? 'text-gray-900' : 'text-accent')}>
                      {row.pos ? '' : '−'}{fmt.currency(row.value)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t-2 border-accent">
                  <span className="font-black text-text">NET CASH</span>
                  <span className="num font-black text-accent text-xl">{fmt.currency(n(report.total_cash_flow))}</span>
                </div>
              </div>
            </div>

            {/* Department breakdown */}
            {depts.length > 0 && (
              <div className="tile p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">What Sold Today</p>
                <div className="space-y-3">
                  {(showAll ? depts : depts.slice(0, 6)).map(dept => {
                    const pct = gross > 0 ? (dept.value / gross * 100) : 0;
                    return (
                      <div key={dept.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-text">{dept.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted">{pct.toFixed(1)}%</span>
                            <span className="num text-sm font-bold text-text">{fmt.currency(dept.value)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {depts.length > 6 && (
                  <button onClick={() => setShowAll(v => !v)} className="mt-4 flex items-center gap-1.5 text-xs text-accent font-semibold">
                    {showAll ? <><ChevronUp className="h-3.5 w-3.5" />Show less</> : <><ChevronDown className="h-3.5 w-3.5" />Show all {depts.length}</>}
                  </button>
                )}
              </div>
            )}

            {/* Deposit */}
            <div className="rounded-2xl bg-accent p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-red-200 mb-3">Today's Deposit</p>
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="flex justify-between gap-10">
                    <span className="text-red-200 text-sm">Store Deposit</span>
                    <span className="num font-bold text-white">{fmt.currency(n(report.store_deposit))}</span>
                  </div>
                  <div className="flex justify-between gap-10">
                    <span className="text-red-200 text-sm">MAC Deposit</span>
                    <span className="num font-bold text-white">{fmt.currency(n(report.mac_deposit))}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-red-200 text-xs">TOTAL DEPOSIT</p>
                  <p className="num text-3xl font-black text-white">{fmt.currency(n(report.total_deposit))}</p>
                </div>
              </div>
            </div>

            {/* Fuel ATG */}
            {(n(report.atg_unleaded) + n(report.atg_diesel)) > 0 && (
              <div className="tile p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Fuel ATG Reading</p>
                <div className="grid grid-cols-4 gap-2">
                  {[{ l: 'Unleaded', v: report.atg_unleaded }, { l: 'Midgrade', v: report.atg_midgrade }, { l: 'Premium', v: report.atg_premium }, { l: 'Diesel', v: report.atg_diesel }].map(f => (
                    <div key={f.l} className="bg-surface rounded-xl p-3 text-center">
                      <p className="text-xs text-muted font-medium">{f.l}</p>
                      <p className="num font-black text-text mt-1">{Number(f.v || 0).toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
