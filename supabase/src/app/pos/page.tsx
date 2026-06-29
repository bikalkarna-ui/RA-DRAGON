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
  AlertTriangle, Clock, DollarSign, Zap, Eye, BarChart3, Plus
} from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtDateLong = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); } catch { return d; } };
const fmtDateShort = (d: string) => { try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return d; } };

// ── Short/Over badge ─────────────────────────────────────────────────────────
function ShortOverBadge({ value, size = 'lg' }: { value: number; size?: 'sm' | 'lg' }) {
  const isShort = value < -0.5;
  const isOver  = value > 0.5;
  const isExact = !isShort && !isOver;
  const label   = isShort ? 'SHORT' : isOver ? 'OVER' : 'EXACT';
  const bg      = isShort ? 'bg-red-100 border-red-300' : isOver ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300';
  const color   = isShort ? 'text-red-700' : isOver ? 'text-green-700' : 'text-gray-600';

  if (size === 'sm') {
    return (
      <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1', bg)}>
        <span className={cn('text-xs font-bold', color)}>{label}</span>
        <span className={cn('num text-sm font-black', color)}>
          {isExact ? '✓' : `${isOver ? '+' : ''}${fmt.currency(value)}`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border-2 p-5', bg)}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">SHORT / OVER</p>
      <div className="flex items-end justify-between">
        <div>
          <p className={cn('num font-black', color, isExact ? 'text-3xl' : 'text-4xl')}>
            {isExact ? '✓ Exact' : `${isOver ? '+' : ''}${fmt.currency(value)}`}
          </p>
          <p className={cn('text-sm font-semibold mt-1', color)}>
            {isShort ? `Drawer is $${Math.abs(value).toFixed(2)} short` : isOver ? `Drawer is $${value.toFixed(2)} over` : 'Drawer balanced perfectly'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Expected</p>
          <p className="num font-bold text-gray-700">{fmt.currency(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Actual</p>
          <p className="num font-bold text-gray-700">{fmt.currency(0)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Full report card ─────────────────────────────────────────────────────────
function ReportCard({ report, onDelete, onRefresh, defaultExpanded = false }: {
  report: any; onDelete: () => void; onRefresh: () => void; defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState(report.store_notes || '');
  const n = (v: any) => Number(v || 0);

  const handleDelete = async () => {
    if (!confirm('Delete this daily report? This cannot be undone.')) return;
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

  const warnings  = report.validation_warnings || [];
  const gross     = n(report.gross_sales);
  const shortOver = n(report.drawer_difference);
  const isToday   = report.report_date === todayStr();

  return (
    <div className={cn('tile overflow-hidden', warnings.length > 0 && 'border-2 border-amber-300')}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <p className="font-black text-text text-lg">
                {isToday ? "Today's Report" : fmtDateShort(report.report_date)}
              </p>
              <span className={cn('chip text-[10px] font-bold',
                report.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                {report.status === 'completed' ? '✓ Completed' : 'In progress'}
              </span>
            </div>
            <p className="text-xs text-muted">{fmtDateLong(report.report_date)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="num text-3xl font-black text-text">{fmt.currency(gross)}</p>
            <p className="text-xs text-muted">Gross Sales</p>
          </div>
        </div>

        {/* SHORT / OVER — most prominent */}
        <div className={cn('rounded-2xl border-2 p-4 mb-4',
          shortOver < -0.5 ? 'border-red-400 bg-red-50' :
          shortOver > 0.5  ? 'border-green-400 bg-green-50' :
          'border-gray-200 bg-gray-50')}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">SHORT / OVER</p>
          <div className="flex items-center justify-between">
            <p className={cn('num font-black text-3xl',
              shortOver < -0.5 ? 'text-red-700' : shortOver > 0.5 ? 'text-green-700' : 'text-gray-500')}>
              {shortOver > 0.5 ? '+' : ''}{fmt.currency(shortOver)}
            </p>
            <div className="text-right">
              <p className={cn('text-sm font-bold',
                shortOver < -0.5 ? 'text-red-600' : shortOver > 0.5 ? 'text-green-600' : 'text-gray-500')}>
                {shortOver < -0.5 ? `⚠ Drawer SHORT by ${fmt.currency(Math.abs(shortOver))}` :
                 shortOver > 0.5  ? `✓ Drawer OVER by ${fmt.currency(shortOver)}` :
                 '✓ Drawer exact'}
              </p>
              {n(report.expected_cash) > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Expected {fmt.currency(n(report.expected_cash))} · Actual {fmt.currency(n(report.actual_cash))}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-bold text-amber-800">AI flagged {warnings.length} issue{warnings.length > 1 ? 's' : ''}</p>
            </div>
            {warnings.map((w: string, i: number) => <p key={i} className="text-xs text-amber-700">• {w}</p>)}
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Cash',    value: n(report.cash_sales) },
            { label: 'Credit',  value: n(report.credit_sales) },
            { label: 'Debit',   value: n(report.debit_sales) },
            { label: 'Checks',  value: n(report.check_sales) },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-surface p-3 text-center">
              <p className="text-[10px] text-muted font-medium">{s.label}</p>
              <p className="num font-bold text-text text-sm mt-0.5">{fmt.currency(s.value)}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => setExpanded(v => !v)}
            className="flex-1 btn btn-ghost text-sm py-2.5 gap-1.5">
            <Eye className="h-4 w-4" />
            {expanded ? 'Hide details' : 'View full report'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 rounded-xl bg-red-50 text-accent px-4 py-2.5 text-sm font-semibold hover:bg-red-100 transition-colors">
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* ── Full report ── */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-5 bg-gray-50/50">

          {/* Sales */}
          <Section title="Sales Breakdown">
            {[
              { label: 'Gross Sales',       value: n(report.gross_sales),       bold: true },
              { label: 'Net Sales',         value: n(report.net_sales) },
              { label: 'Fuel Sales',        value: n(report.fuel_sales) },
              { label: 'Inside Sales',      value: n(report.inside_sales) },
              { label: 'Merchandise',       value: n(report.merchandise_sales) },
              { label: 'Lottery Sales',     value: n(report.lottery_sales) },
              { label: 'Scratch Off',       value: n(report.scratch_sales) },
              { label: 'Taxes Collected',   value: n(report.taxes) },
              { label: 'Discounts',         value: n(report.discounts),         neg: true },
              { label: 'Refunds',           value: n(report.refunds),           neg: true },
              { label: 'Transactions',      value: n(report.transactions),       currency: false },
              { label: 'Customers',         value: n(report.customers),          currency: false },
            ].filter(r => r.value !== 0).map(r => <Row key={r.label} {...r} />)}
          </Section>

          {/* Payment methods */}
          <Section title="Payment Methods">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Cash',          value: n(report.cash_sales) },
                { label: 'Credit Card',   value: n(report.credit_sales) },
                { label: 'Debit',         value: n(report.debit_sales) },
                { label: 'EBT / SNAP',    value: n(report.ebt_sales) },
                { label: 'Checks',        value: n(report.check_sales) },
                { label: 'Money Orders',  value: n(report.money_order_sales) },
                { label: 'ATM',           value: n(report.atm_sales) },
              ].filter(r => r.value > 0).map(r => (
                <div key={r.label} className="rounded-xl bg-white border border-border p-3">
                  <p className="text-[10px] text-muted font-medium">{r.label}</p>
                  <p className="num font-bold text-text">{fmt.currency(r.value)}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Cash management */}
          {(n(report.actual_cash) + n(report.safe_drops) + n(report.paid_outs) + n(report.paid_ins)) > 0 && (
            <Section title="Cash Management">
              {[
                { label: 'Cash Sales',      value: n(report.cash_sales) },
                { label: 'Beginning Till',  value: n(report.beginning_till) },
                { label: 'Paid Ins',        value: n(report.paid_ins) },
                { label: 'Safe Loans',      value: n(report.safe_loans) },
                { label: 'Safe Drops',      value: n(report.safe_drops),     neg: true },
                { label: 'Paid Outs',       value: n(report.paid_outs),      neg: true },
                { label: 'Expected Cash',   value: n(report.expected_cash) },
                { label: 'Actual Cash',     value: n(report.actual_cash) },
                { label: 'Cash Deposit',    value: n(report.cash_deposit) },
                { label: 'Ending Till',     value: n(report.ending_till) },
              ].filter(r => r.value !== 0).map(r => <Row key={r.label} {...r} />)}
              {/* Short/over highlighted */}
              <div className={cn('flex justify-between items-center px-3 py-2.5 rounded-xl mt-2 font-black',
                shortOver < -0.5 ? 'bg-red-100 text-red-700' : shortOver > 0.5 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700')}>
                <span>SHORT / OVER</span>
                <span className="num text-lg">{shortOver >= 0 ? '+' : ''}{fmt.currency(shortOver)}</span>
              </div>
            </Section>
          )}

          {/* Lottery */}
          {(n(report.lottery_sales) + n(report.scratch_sales)) > 0 && (
            <Section title="Lottery">
              {[
                { label: 'Lottery Sales',     value: n(report.lottery_sales) },
                { label: 'Scratch Off Sales', value: n(report.scratch_sales) },
                { label: 'Lottery Payouts',   value: n(report.lottery_payouts),  neg: true },
                { label: 'Scratch Payouts',   value: n(report.scratch_payouts),  neg: true },
                { label: 'Settlement',        value: n(report.lottery_settlement) },
                { label: 'Commission',        value: n(report.lottery_commission) },
              ].filter(r => r.value !== 0).map(r => <Row key={r.label} {...r} />)}
            </Section>
          )}

          {/* Fuel */}
          {n(report.fuel_sales) > 0 && (
            <Section title="Fuel Sales">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Unleaded', sales: n(report.fuel_unleaded_sales), gallons: n(report.fuel_unleaded_gallons) },
                  { label: 'Midgrade', sales: n(report.fuel_midgrade_sales), gallons: n(report.fuel_midgrade_gallons) },
                  { label: 'Premium',  sales: n(report.fuel_premium_sales),  gallons: n(report.fuel_premium_gallons) },
                  { label: 'Diesel',   sales: n(report.fuel_diesel_sales),   gallons: n(report.fuel_diesel_gallons) },
                ].filter(f => f.sales > 0 || f.gallons > 0).map(f => (
                  <div key={f.label} className="rounded-xl bg-white border border-border p-3">
                    <p className="text-[10px] text-muted font-medium">{f.label}</p>
                    <p className="num font-bold text-text">{fmt.currency(f.sales)}</p>
                    {f.gallons > 0 && <p className="text-[10px] text-muted mt-0.5">{f.gallons.toFixed(3)} gal</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

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

          {/* Store notes */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Store Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes}
              className="inp text-sm min-h-20 resize-none" placeholder="Add notes for this day…" />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, neg, currency = true }: { label: string; value: number; bold?: boolean; neg?: boolean; currency?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className={cn('text-sm', bold ? 'font-bold text-text' : 'text-gray-600')}>{label}</span>
      <span className={cn('num text-sm font-semibold', bold ? 'text-text' : neg ? 'text-accent' : 'text-gray-800')}>
        {neg ? '−' : ''}{currency ? fmt.currency(value) : value.toLocaleString()}
      </span>
    </div>
  );
}

function UploadZone({ date, onSuccess }: { date: string; onSuccess: (data: any) => void }) {
  const [uploads, setUploads] = useState<any[]>([]);

  const handleResult = (data: any) => {
    setUploads(prev => [...prev, { type: data.reportType, warnings: data.warnings || [] }]);
    onSuccess(data);
  };

  return (
    <div className="tile p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <BarChart3 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-bold text-text">Upload Reports</p>
          <p className="text-xs text-muted mt-0.5">AI identifies report type automatically and merges everything into one daily report. Upload as many as you need.</p>
        </div>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <p className="text-xs font-semibold text-blue-800 mb-1">Accepted:</p>
        <p className="text-xs text-blue-700">Store Close · Till/Register · Lottery · Scratch Off · Department · Safe Drop · Paid Out · Paid In · Fuel · PLU · Summary</p>
      </div>

      <MultiScan
        endpoint="/api/scan-daily-report"
        onResult={handleResult}
        title="Scan or Upload Report"
        hint="Photo or PDF — AI reads report type and all numbers instantly"
        extraFields={{ report_date: date }}
      />

      {uploads.map((u, i) => (
        <div key={i} className={cn('rounded-xl px-4 py-3 flex items-center gap-2 text-sm',
          u.warnings?.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200')}>
          {u.warnings?.length > 0
            ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            : <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
          <span className={u.warnings?.length > 0 ? 'text-amber-800' : 'text-green-800'}>
            <b className="capitalize">{(u.type || 'unknown').replace('_', ' ')}</b> report processed
            {u.warnings?.length > 0 && ` · ${u.warnings.length} warning${u.warnings.length > 1 ? 's' : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DailyReportsPage() {
  const [mounted, setMounted]       = useState(false);
  const [todayReport, setTodayReport] = useState<any>(null);
  const [prevReports, setPrevReports] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);
  const { store } = useStore();

  useEffect(() => { setMounted(true); }, []);

  const loadData = useCallback(async () => {
    if (!store) return;
    try {
      const sb = createClient();
      const today = todayStr();
      const [{ data: tr }, { data: prev }] = await Promise.all([
        sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
        sb.from('daily_reports').select('*').eq('store_id', store.id).lt('report_date', today).order('report_date', { ascending: false }).limit(10),
      ]);
      setTodayReport(tr || null);
      setPrevReports(prev || []);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) loadData(); }, [mounted, store, loadData]);

  if (!mounted) return null;

  const today     = todayStr();
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
                  defaultExpanded={false}
                  onDelete={() => { setTodayReport(null); setShowAddMore(false); loadData(); }}
                  onRefresh={loadData}
                />
                <button onClick={() => setShowAddMore(v => !v)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm font-semibold text-muted hover:border-accent hover:text-accent transition-colors">
                  <Plus className="h-4 w-4" />
                  {showAddMore ? 'Hide upload' : 'Add more reports to today'}
                </button>
                {showAddMore && (
                  <UploadZone date={today} onSuccess={() => { loadData(); }} />
                )}
              </>
            ) : (
              <>
                <div className="tile p-8 text-center border-2 border-dashed border-gray-200">
                  <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                  <p className="font-bold text-gray-700 text-lg mb-1">No report yet today</p>
                  <p className="text-gray-400 text-sm">Upload any close report below — AI identifies the type and extracts all numbers automatically</p>
                </div>
                <UploadZone date={today} onSuccess={(data) => { if (data.report) { setTodayReport(data.report); } loadData(); }} />
              </>
            )}

            {/* PREVIOUS REPORTS */}
            {prevReports.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Previous Reports</p>
                <div className="space-y-3">
                  {prevReports.map(r => (
                    <ReportCard key={r.id} report={r} onDelete={loadData} onRefresh={loadData} />
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
