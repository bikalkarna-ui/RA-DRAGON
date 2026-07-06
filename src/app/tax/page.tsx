'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Download, RefreshCw, FileText } from 'lucide-react';

export default function TaxPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [quarter, setQuarter] = useState(() => {
    const m = new Date().getMonth();
    return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
  });
  const [year] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const QUARTERS: Record<string,[string,string]> = {
    Q1: [`${year}-01-01`, `${year}-03-31`],
    Q2: [`${year}-04-01`, `${year}-06-30`],
    Q3: [`${year}-07-01`, `${year}-09-30`],
    Q4: [`${year}-10-01`, `${year}-12-31`],
  };

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const [start, end] = QUARTERS[quarter];
    const { data } = await createClient().from('daily_reports').select('*')
      .eq('store_id', store.id).gte('report_date', start).lte('report_date', end)
      .order('report_date');
    setReports(data || []);
    setLoading(false);
  }, [store, quarter]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, quarter, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);
  const sum = (field: string) => reports.reduce((s, r) => s + n(r[field]), 0);

  const grossSales    = sum('gross_sales');
  const fuelSales     = sum('fuel_sales');
  const insideSales   = sum('inside_sales');
  const totalTax      = sum('taxes');
  const totalDays     = reports.length;

  const exportCSV = () => {
    const rows = [
      ['Date','Gross Sales','Fuel Sales','Inside Sales','Taxes','Cash','Credit','Debit','Check'],
      ...reports.map(r => [
        r.report_date, n(r.gross_sales), n(r.fuel_sales), n(r.inside_sales),
        n(r.taxes), n(r.cash_sales), n(r.credit_sales), n(r.debit_sales), n(r.check_sales)
      ]),
      ['TOTAL', grossSales, fuelSales, insideSales, totalTax, sum('cash_sales'), sum('credit_sales'), sum('debit_sales'), sum('check_sales')]
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `tax-report-${quarter}-${year}.csv`; a.click();
  };

  return (
    <Screen title="Tax Reporting" subtitle={`${quarter} ${year} — ${totalDays} days`}
      action={<button onClick={exportCSV} className="btn btn-ghost h-9 px-4 text-sm gap-1.5"><Download className="h-4 w-4" />Export CSV</button>}>
      <div className="space-y-4">
        {/* Quarter selector */}
        <div className="flex gap-2">
          {['Q1','Q2','Q3','Q4'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors',
                quarter===q ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border')}>
              {q}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="tile p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">{quarter} {year} Summary</p>
          <div className="space-y-3">
            {[
              { label: 'Gross Sales', value: grossSales, bold: true },
              { label: 'Fuel Sales', value: fuelSales },
              { label: 'Inside / Non-Fuel Sales', value: insideSales },
              { label: 'Sales Tax Collected', value: totalTax, color: 'text-accent' },
              { label: 'Avg Daily Sales', value: totalDays > 0 ? grossSales/totalDays : 0 },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className={cn('text-sm', row.bold ? 'font-bold text-text' : 'text-gray-600')}>{row.label}</span>
                <span className={cn('num text-sm font-bold', row.color || (row.bold ? 'text-text' : 'text-gray-700'))}>
                  {fmt.currency(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tax liability box */}
        <div className="tile p-5 border-l-4 border-l-accent">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Tax Liability</p>
          <p className="num font-black text-4xl text-accent">{fmt.currency(totalTax)}</p>
          <p className="text-xs text-muted mt-1">Total sales tax collected this quarter — pay to state</p>
        </div>

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {/* Monthly breakdown */}
        {!loading && reports.length > 0 && (
          <div className="tile overflow-hidden">
            <div className="px-5 py-3 border-b border-border"><p className="text-xs font-bold uppercase tracking-wide text-muted">Daily Breakdown</p></div>
            <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
              {reports.map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{(() => { try { return new Date(r.report_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); } catch { return r.report_date; } })()}</p>
                    <p className="text-xs text-muted">Tax: {fmt.currency(n(r.taxes))}</p>
                  </div>
                  <p className="num font-bold text-text">{fmt.currency(n(r.gross_sales))}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={exportCSV} className="btn btn-accent btn-full gap-2 py-4">
          <Download className="h-5 w-5" />Export {quarter} {year} Tax Report (CSV)
        </button>
        <p className="text-xs text-muted text-center">Share this CSV with your accountant for quarterly tax filing</p>
      </div>
    </Screen>
  );
}
