'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { MultiScan } from '@/components/ui/multi-scan';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  CheckCircle, Trash2, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, FileText, Clock, DollarSign, Zap, Eye,
  BarChart3, TrendingUp, TrendingDown, Plus
} from 'lucide-react';

const fmtDate = (d: string) => {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
};
const fmtShort = (d: string) => {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
};
const today = () => new Date().toISOString().split('T')[0];
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; };

function ReportCard({ report, onDelete, onRefresh }: { report: any; onDelete: () => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState(report.store_notes || '');
  const n = (v: any) => Number(v || 0);

  const handleDelete = async () => {
    if (!confirm('Delete this daily report? All uploads for this date will be removed.')) return;
    setDeleting(true);
    await fetch(`/api/daily-report?id=${report.id}`, { method: 'DELETE' });
    onDelete();
  };

  const saveNotes = async () => {
    await fetch('/api/daily-report', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: report.id, store_notes: notes }),
    });
    onRefresh();
  };

  const warnings = report.validation_warnings || [];
  const grossSales = n(report.gross_sales);
  const drawerDiff = n(report.drawer_difference);
  const isToday = report.report_date === today();

  return (
    <div className={cn('tile overflow-hidden', warnings.length > 0 && 'border-2 border-amber-300')}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <p className="font-black text-text">{isToday ? "Today's Report" : fmtShort(report.report_date)}</p>
              <span className={cn('chip text-[10px] font-bold',
                report.status === 'completed' ? 'bg-green-100 text-green-700' :
                report.status === 'needs_review' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600')}>
                {report.status === 'completed' ? '✓ Completed' : report.status === 'needs_review' ? '⚠ Review needed' : 'In progress'}
              </span>
            </div>
            <p className="text-xs text-muted">{fmtDate(report.report_date)}</p>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-black text-text">{fmt.currency(grossSales)}</p>
            <p className="text-xs text-muted">Gross Sales</p>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-bold text-amber-800">AI detected {warnings.length} issue{warnings.length > 1 ? 's' : ''}</p>
            </div>
            {warnings.map((w: string, i: number) => (
              <p key={i} className="text-xs text-amber-700">• {w}</p>
            ))}
          </div>
        )}

        {/* Key metrics strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={cn('rounded-xl p-3 text-center border-2',
            drawerDiff === 0 ? 'border-gray-200 bg-gray-50' :
            drawerDiff < 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50')}>
            <p className="text-[10px] text-muted font-medium mb-0.5">Drawer</p>
            <p className={cn('num font-black text-sm',
              drawerDiff === 0 ? 'text-gray-700' : drawerDiff < 0 ? 'text-accent' : 'text-green-700')}>
              {drawerDiff >= 0 ? '+' : ''}{fmt.currency(drawerDiff)}
            </p>
          </div>
          <div className="rounded-xl p-3 text-center bg-gray-50">
            <p className="text-[10px] text-muted font-medium mb-0.5">Cash</p>
            <p className="num font-black text-sm text-text">{fmt.currency(n(report.actual_cash))}</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-gray-50">
            <p className="text-[10px] text-muted font-medium mb-0.5">Credit</p>
            <p className="num font-black text-sm text-text">{fmt.currency(n(report.credit_sales))}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => setExpanded(v => !v)}
            className="flex-1 btn btn-ghost text-sm py-2.5 gap-1.5">
            <Eye className="h-4 w-4" />
            {expanded ? 'Hide' : 'View Full Report'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 rounded-xl bg-red-50 text-accent px-4 py-2.5 text-sm font-semibold hover:bg-red-100 transition-colors">
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Full report details */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-5 bg-gray-50/50">
          {/* Sales breakdown */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Sales Breakdown</p>
            <div className="space-y-1.5">
              {[
                { label: 'Gross Sales',        value: n(report.gross_sales),        bold: true },
                { label: 'Net Sales',          value: n(report.net_sales) },
                { label: 'Fuel Sales',         value: n(report.fuel_sales) },
                { label: 'Inside Sales',       value: n(report.inside_sales) },
                { label: 'Merchandise',        value: n(report.merchandise_sales) },
                { label: 'Lottery Sales',      value: n(report.lottery_sales) },
                { label: 'Scratch Off',        value: n(report.scratch_sales) },
                { label: 'Taxes',              value: n(report.taxes) },
                { label: 'Discounts',          value: n(report.discounts),          negative: true },
                { label: 'Refunds',            value: n(report.refunds),            negative: true },
              ].filter(r => r.value !== 0).map(row => (
                <div key={row.label} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className={cn('text-sm', row.bold ? 'font-bold text-text' : 'text-gray-600')}>{row.label}</span>
                  <span className={cn('num text-sm font-semibold', row.bold ? 'text-text' : row.negative ? 'text-accent' : 'text-gray-800')}>
                    {row.negative ? '−' : ''}{fmt.currency(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Payment Methods</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Cash',          value: n(report.cash_sales) },
                { label: 'Credit Card',   value: n(report.credit_sales) },
                { label: 'Debit',         value: n(report.debit_sales) },
                { label: 'EBT / SNAP',    value: n(report.ebt_sales) },
                { label: 'Checks',        value: n(report.check_sales) },
                { label: 'Money Orders',  value: n(report.money_order_sales) },
                { label: 'ATM',           value: n(report.atm_sales) },
              ].filter(r => r.value > 0).map(row => (
                <div key={row.label} className="rounded-xl bg-white border border-gray-200 p-3">
                  <p className="text-[10px] text-muted font-medium">{row.label}</p>
                  <p className="num font-bold text-text">{fmt.currency(row.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cash management */}
          {(n(report.actual_cash) + n(report.safe_drops) + n(report.paid_outs)) > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Cash Management</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Expected Cash',   value: n(report.expected_cash) },
                  { label: 'Actual Cash',     value: n(report.actual_cash) },
                  { label: 'Cash Deposit',    value: n(report.cash_deposit) },
                  { label: 'Safe Drops',      value: n(report.safe_drops),       negative: true },
                  { label: 'Safe Loans',      value: n(report.safe_loans) },
                  { label: 'Paid Outs',       value: n(report.paid_outs),        negative: true },
                  { label: 'Paid Ins',        value: n(report.paid_ins) },
                  { label: 'Beginning Till',  value: n(report.beginning_till) },
                  { label: 'Ending Till',     value: n(report.ending_till) },
                ].filter(r => r.value !== 0).map(row => (
                  <div key={row.label} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className={cn('num text-sm font-semibold', row.negative ? 'text-accent' : 'text-gray-800')}>
                      {row.negative ? '−' : ''}{fmt.currency(row.value)}
                    </span>
                  </div>
                ))}
                {/* Drawer difference highlighted */}
                <div className={cn('flex justify-between py-2 px-3 rounded-xl mt-2',
                  drawerDiff === 0 ? 'bg-green-50' : drawerDiff < 0 ? 'bg-red-50' : 'bg-green-50')}>
                  <span className="text-sm font-bold text-text">Drawer Difference</span>
                  <span className={cn('num text-sm font-black', drawerDiff < 0 ? 'text-accent' : 'text-green-700')}>
                    {drawerDiff >= 0 ? '+' : ''}{fmt.currency(drawerDiff)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Lottery */}
          {n(report.lottery_sales) + n(report.scratch_sales) > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Lottery</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Lottery Sales',    value: n(report.lottery_sales) },
                  { label: 'Scratch Off Sales', value: n(report.scratch_sales) },
                  { label: 'Lottery Payouts',  value: n(report.lottery_payouts),  negative: true },
                  { label: 'Scratch Payouts',  value: n(report.scratch_payouts),  negative: true },
                  { label: 'Settlement',       value: n(report.lottery_settlement) },
                  { label: 'Commission',       value: n(report.lottery_commission) },
                ].filter(r => r.value !== 0).map(row => (
                  <div key={row.label} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className={cn('num text-sm font-semibold', row.negative ? 'text-accent' : 'text-gray-800')}>
                      {row.negative ? '−' : ''}{fmt.currency(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fuel */}
          {n(report.fuel_sales) > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Fuel</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Unleaded', sales: n(report.fuel_unleaded_sales), gallons: n(report.fuel_unleaded_gallons) },
                  { label: 'Midgrade', sales: n(report.fuel_midgrade_sales), gallons: n(report.fuel_midgrade_gallons) },
                  { label: 'Premium',  sales: n(report.fuel_premium_sales),  gallons: n(report.fuel_premium_gallons) },
                  { label: 'Diesel',   sales: n(report.fuel_diesel_sales),   gallons: n(report.fuel_diesel_gallons) },
                ].filter(f => f.sales > 0 || f.gallons > 0).map(f => (
                  <div key={f.label} className="rounded-xl bg-white border border-gray-200 p-3">
                    <p className="text-[10px] text-muted font-medium">{f.label}</p>
                    <p className="num font-bold text-text">{fmt.currency(f.sales)}</p>
                    {f.gallons > 0 && <p className="text-[10px] text-muted">{f.gallons.toFixed(3)} gal</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Store Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="inp text-sm min-h-20 resize-none"
              placeholder="Add notes for this day…"
              onBlur={saveNotes}
            />
          </div>

          {/* AI notes */}
          {report.ai_notes && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-violet-600" />
                <p className="text-xs font-bold text-violet-700">AI Notes</p>
              </div>
              <p className="text-xs text-violet-700">{report.ai_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadZone({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [uploads, setUploads] = useState<any[]>([]);

  const handleResult = (data: any) => {
    if (data.report) {
      setUploads(prev => [...prev, {
        type: data.reportType,
        date: data.reportDate,
        warnings: data.warnings || [],
      }]);
      onSuccess();
    }
  };

  return (
    <div className="tile p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <BarChart3 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-bold text-text">Upload Today's Reports</p>
          <p className="text-xs text-muted mt-0.5">
            Upload any report type — AI identifies it automatically and merges everything into one daily report.
            You can upload multiple times.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <p className="text-xs font-semibold text-blue-800 mb-1">Accepted report types:</p>
        <p className="text-xs text-blue-700">
          Store Close · Till / Register · Lottery · Scratch Off · Department Sales ·
          Safe Drop · Paid Out · Paid In · Fuel · PLU Sales · Summary
        </p>
      </div>

      <MultiScan
        endpoint="/api/scan-daily-report"
        onResult={handleResult}
        title="Scan or Upload Report"
        hint="Take photos of all pages — AI identifies report type and extracts all numbers"
        extraFields={{ report_date: date }}
      />

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div key={i} className={cn('rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm',
              u.warnings?.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200')}>
              {u.warnings?.length > 0
                ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                : <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
              <span className={u.warnings?.length > 0 ? 'text-amber-800' : 'text-green-800'}>
                <span className="font-semibold capitalize">{u.type?.replace('_', ' ')}</span> report processed
                {u.warnings?.length > 0 && ` · ${u.warnings.length} warning${u.warnings.length > 1 ? 's' : ''}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [todayReport, setTodayReport] = useState<any>(null);
  const [prevReports, setPrevReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { store } = useStore();

  useEffect(() => { setMounted(true); }, []);

  const loadData = useCallback(async () => {
    if (!store) return;
    try {
      const sb = createClient();
      const todayStr = today();

      // Get today's report
      const { data: tr } = await sb
        .from('daily_reports').select('*')
        .eq('store_id', store.id).eq('report_date', todayStr).maybeSingle();
      setTodayReport(tr || null);

      // Get last 10 previous reports
      const { data: prev } = await sb
        .from('daily_reports').select('*')
        .eq('store_id', store.id)
        .lt('report_date', todayStr)
        .order('report_date', { ascending: false })
        .limit(10);
      setPrevReports(prev || []);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => {
    if (mounted && store) loadData();
  }, [mounted, store, loadData]);

  if (!mounted) return null;

  const todayStr = today();
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Screen title="Daily Reports" subtitle={todayLabel}
      action={
        <button onClick={() => { setRefreshing(true); loadData(); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      }>
      <div className="space-y-5">

        {loading ? (
          <div className="tile p-10 text-center">
            <RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {/* TODAY */}
            {todayReport ? (
              <>
                <ReportCard
                  report={todayReport}
                  onDelete={() => { setTodayReport(null); loadData(); }}
                  onRefresh={loadData}
                />
                {/* Option to add more uploads */}
                <button
                  onClick={() => setTodayReport({ ...todayReport, _showUpload: !todayReport._showUpload })}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm font-semibold text-muted hover:border-accent hover:text-accent transition-colors">
                  <Plus className="h-4 w-4" />
                  Add more reports to today
                </button>
                {todayReport._showUpload && (
                  <UploadZone date={todayStr} onSuccess={loadData} />
                )}
              </>
            ) : (
              <>
                {/* No report yet today */}
                <div className="tile p-6 border-2 border-dashed border-gray-200 text-center">
                  <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-bold text-gray-700 text-lg mb-1">No report yet today</p>
                  <p className="text-gray-400 text-sm">Upload your close reports below. AI identifies each one automatically.</p>
                </div>
                <UploadZone date={todayStr} onSuccess={loadData} />
              </>
            )}

            {/* PREVIOUS REPORTS */}
            {prevReports.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Previous Reports</p>
                <div className="space-y-3">
                  {prevReports.map(r => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      onDelete={loadData}
                      onRefresh={loadData}
                    />
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
