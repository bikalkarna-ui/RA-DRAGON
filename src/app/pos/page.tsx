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
  AlertTriangle, Clock, BarChart3, Plus, Zap, Eye,
  DollarSign, Check, Circle
} from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];
const fmtLong  = (d: string) => { try { return new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); } catch { return d; } };
const fmtShort = (d: string) => { try { return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); } catch { return d; } };
const fmtTime  = (d: string) => { try { return new Date(d).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); } catch { return ''; } };

type Tab = 'report' | 'checklist' | 'timeline';

// ── Short/Over Box ────────────────────────────────────────────────────────────
function ShortOverBox({ value, expected, actual }: { value: number; expected: number; actual: number }) {
  const short = value < -0.5;
  const over  = value > 0.5;
  return (
    <div className={cn('rounded-2xl border-2 p-5 mb-4',
      short ? 'border-red-400 bg-red-50' : over ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50')}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">SHORT / OVER</p>
      <div className="flex items-end justify-between">
        <div>
          <p className={cn('num font-black text-5xl leading-none', short ? 'text-red-700' : over ? 'text-green-700' : 'text-gray-500')}>
            {over ? '+' : ''}{fmt.currency(value)}
          </p>
          <p className={cn('text-sm font-semibold mt-2', short ? 'text-red-600' : over ? 'text-green-600' : 'text-gray-500')}>
            {short ? `⚠ Drawer is ${fmt.currency(Math.abs(value))} short` :
             over  ? `✓ Drawer is ${fmt.currency(value)} over` :
             '✓ Drawer balanced perfectly'}
          </p>
        </div>
        {(expected > 0 || actual > 0) && (
          <div className="text-right space-y-1">
            <div><p className="text-xs text-gray-400">Expected</p><p className="num font-bold text-gray-700">{fmt.currency(expected)}</p></div>
            <div><p className="text-xs text-gray-400">Actual</p><p className="num font-bold text-gray-700">{fmt.currency(actual)}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full Report View ──────────────────────────────────────────────────────────
function ReportFull({ r }: { r: any }) {
  const n = (v: any) => Number(v || 0);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );

  const Row = ({ label, value, neg, bold, isCurrency = true }: any) => {
    if (!value && value !== 0) return null;
    if (value === 0 && !bold) return null;
    return (
      <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
        <span className={cn('text-sm', bold ? 'font-bold text-text' : 'text-gray-600')}>{label}</span>
        <span className={cn('num text-sm font-semibold', bold ? 'text-text' : neg ? 'text-accent' : 'text-gray-800')}>
          {neg && value > 0 ? '−' : ''}{isCurrency ? fmt.currency(value) : value.toLocaleString()}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Section title="Sales Breakdown">
        <Row label="Gross Sales"       value={n(r.gross_sales)}       bold />
        <Row label="Net Sales"         value={n(r.net_sales)} />
        <Row label="Fuel Sales"        value={n(r.fuel_sales)} />
        <Row label="Inside Sales"      value={n(r.inside_sales)} />
        <Row label="Merchandise"       value={n(r.merchandise_sales)} />
        <Row label="Lottery Sales"     value={n(r.lottery_sales)} />
        <Row label="Scratch Off"       value={n(r.scratch_sales)} />
        <Row label="Taxes Collected"   value={n(r.taxes)} />
        <Row label="Discounts"         value={n(r.discounts)} neg />
        <Row label="Refunds"           value={n(r.refunds)} neg />
        <Row label="Transactions"      value={n(r.transactions)} isCurrency={false} />
        <Row label="Customers"         value={n(r.customers)} isCurrency={false} />
      </Section>

      <Section title="Payment Methods">
        <Row label="Cash"         value={n(r.cash_sales)} />
        <Row label="Credit Card"  value={n(r.credit_sales)} />
        <Row label="Debit"        value={n(r.debit_sales)} />
        <Row label="EBT / SNAP"   value={n(r.ebt_sales)} />
        <Row label="Checks"       value={n(r.check_sales)} />
        <Row label="Money Orders" value={n(r.money_order_sales)} />
        <Row label="ATM"          value={n(r.atm_sales)} />
      </Section>

      {(n(r.actual_cash) + n(r.safe_drops) + n(r.paid_outs) + n(r.paid_ins)) > 0 && (
        <Section title="Cash Management">
          <Row label="Cash Sales"     value={n(r.cash_sales)} />
          <Row label="Beginning Till" value={n(r.beginning_till)} />
          <Row label="Safe Loans"     value={n(r.safe_loans)} />
          <Row label="Paid Ins"       value={n(r.paid_ins)} />
          <Row label="Safe Drops"     value={n(r.safe_drops)} neg />
          <Row label="Paid Outs"      value={n(r.paid_outs)} neg />
          <Row label="Expected Cash"  value={n(r.expected_cash)} />
          <Row label="Actual Cash"    value={n(r.actual_cash)} />
          <Row label="Cash Deposit"   value={n(r.cash_deposit)} />
          <Row label="Ending Till"    value={n(r.ending_till)} />
          <div className={cn('flex justify-between items-center px-3 py-2.5 rounded-xl mt-2 font-black',
            n(r.drawer_difference) < -0.5 ? 'bg-red-100 text-red-700' :
            n(r.drawer_difference) > 0.5  ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
            <span>SHORT / OVER</span>
            <span className="num text-lg">{n(r.drawer_difference) >= 0 ? '+' : ''}{fmt.currency(n(r.drawer_difference))}</span>
          </div>
        </Section>
      )}

      {(n(r.lottery_sales) + n(r.scratch_sales)) > 0 && (
        <Section title="Lottery">
          <Row label="Lottery Sales"     value={n(r.lottery_sales)} />
          <Row label="Scratch Off Sales" value={n(r.scratch_sales)} />
          <Row label="Lottery Payouts"   value={n(r.lottery_payouts)} neg />
          <Row label="Scratch Payouts"   value={n(r.scratch_payouts)} neg />
          <Row label="Settlement"        value={n(r.lottery_settlement)} />
          <Row label="Commission"        value={n(r.lottery_commission)} />
        </Section>
      )}

      {n(r.fuel_sales) > 0 && (
        <Section title="Fuel">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Unleaded', sales: n(r.fuel_unleaded_sales), gal: n(r.fuel_unleaded_gallons) },
              { label: 'Midgrade', sales: n(r.fuel_midgrade_sales), gal: n(r.fuel_midgrade_gallons) },
              { label: 'Premium',  sales: n(r.fuel_premium_sales),  gal: n(r.fuel_premium_gallons)  },
              { label: 'Diesel',   sales: n(r.fuel_diesel_sales),   gal: n(r.fuel_diesel_gallons)   },
            ].filter(f => f.sales > 0 || f.gal > 0).map(f => (
              <div key={f.label} className="rounded-xl bg-surface border border-border p-3">
                <p className="text-[10px] text-muted">{f.label}</p>
                <p className="num font-bold text-text">{fmt.currency(f.sales)}</p>
                {f.gal > 0 && <p className="text-[10px] text-muted">{f.gal.toFixed(3)} gal</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────
function ReportCard({ report, onDelete, onRefresh }: { report: any; onDelete: () => void; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState(report.store_notes || '');
  const n = (v: any) => Number(v || 0);
  const warnings = report.validation_warnings || [];
  const gross = n(report.gross_sales);
  const shortOver = n(report.drawer_difference);
  const isToday = report.report_date === todayStr();

  const handleDelete = async () => {
    if (!confirm('Delete this daily report? This cannot be undone.')) return;
    setDeleting(true);
    await fetch(`/api/daily-report?id=${report.id}`, { method: 'DELETE' });
    onDelete();
  };

  return (
    <div className={cn('tile overflow-hidden', warnings.length > 0 && 'border-2 border-amber-300')}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="font-black text-text">{isToday ? "Today's Report" : fmtShort(report.report_date)}</p>
              <span className={cn('chip text-[10px]',
                report.status === 'completed' ? 'chip-green' : 'chip-gray')}>
                {report.status === 'completed' ? '✓ Complete' : 'In progress'}
              </span>
            </div>
            <p className="text-xs text-muted">{fmtLong(report.report_date)}</p>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-black text-text">{fmt.currency(gross)}</p>
            <p className="text-xs text-muted">Gross Sales</p>
          </div>
        </div>

        <ShortOverBox value={shortOver} expected={n(report.expected_cash)} actual={n(report.actual_cash)} />

        {warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-amber-600" /><p className="text-xs font-bold text-amber-800">AI flagged {warnings.length} issue{warnings.length > 1 ? 's' : ''}</p></div>
            {warnings.map((w: string, i: number) => <p key={i} className="text-xs text-amber-700">• {w}</p>)}
          </div>
        )}

        {/* Payment strip */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Cash',    value: n(report.cash_sales) },
            { label: 'Credit',  value: n(report.credit_sales) },
            { label: 'Debit',   value: n(report.debit_sales) },
            { label: 'Checks',  value: n(report.check_sales) },
          ].map(s => (
            <div key={s.label} className="rounded-xl bg-surface p-2.5 text-center">
              <p className="text-[10px] text-muted">{s.label}</p>
              <p className="num font-bold text-text text-sm mt-0.5">{fmt.currency(s.value)}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setExpanded(v => !v)} className="flex-1 btn btn-ghost text-sm py-2.5 gap-1.5">
            <Eye className="h-4 w-4" />{expanded ? 'Hide' : 'View full report'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 rounded-xl bg-red-50 text-accent px-4 py-2.5 text-sm font-semibold hover:bg-red-100 transition-colors">
            <Trash2 className="h-4 w-4" />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-5 space-y-5 bg-gray-50/50">
          <ReportFull r={report} />
          {report.ai_notes && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1"><Zap className="h-3.5 w-3.5 text-violet-600" /><p className="text-xs font-bold text-violet-700">AI Notes</p></div>
              <p className="text-xs text-violet-700">{report.ai_notes}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Store Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              onBlur={() => fetch('/api/daily-report', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.id, store_notes: notes }) })}
              className="inp text-sm min-h-20 resize-none" placeholder="Add notes for this day…" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Closing Checklist ─────────────────────────────────────────────────────────
function ClosingChecklist({ storeId }: { storeId: string }) {
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await fetch('/api/checklist');
    const data = await res.json();
    setChecklist(data.checklist || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (field: string) => {
    const updated = { ...checklist, [field]: !checklist[field] };
    setChecklist(updated);
    const allDone = ITEMS.every(i => updated[i.key]);
    if (allDone) updated.is_closed = true;
    await fetch('/api/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
    load();
  };

  const ITEMS = [
    { key: 'store_close_done',      label: 'Store close report uploaded',      icon: '📊' },
    { key: 'lottery_counted',       label: 'Lottery tickets counted',           icon: '🎰' },
    { key: 'scratch_verified',      label: 'Scratch-offs verified',             icon: '🎟' },
    { key: 'safe_drops_entered',    label: 'Safe drops entered',                icon: '🔒' },
    { key: 'paid_outs_entered',     label: 'Paid outs recorded',                icon: '💸' },
    { key: 'deposit_prepared',      label: 'Deposit prepared',                  icon: '🏦' },
    { key: 'invoices_uploaded',     label: 'Invoices scanned & uploaded',       icon: '📄' },
    { key: 'employees_clocked_out', label: 'All employees clocked out',         icon: '👥' },
  ];

  const done = ITEMS.filter(i => checklist?.[i.key]).length;
  const pct  = Math.round((done / ITEMS.length) * 100);

  if (loading) return <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="tile p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-text">Closing Checklist</p>
          <span className={cn('chip font-bold text-sm', checklist?.is_closed ? 'chip-green' : pct === 100 ? 'chip-green' : 'chip-gray')}>
            {checklist?.is_closed ? '✓ Store Closed' : `${done}/${ITEMS.length}`}
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className={cn('h-full rounded-full transition-all duration-500', pct === 100 ? 'bg-green-500' : 'bg-accent')}
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted">{pct === 100 ? 'All done! Store can be closed.' : `${ITEMS.length - done} items remaining`}</p>
      </div>

      {/* Checklist items */}
      <div className="tile overflow-hidden divide-y divide-border">
        {ITEMS.map(item => (
          <button key={item.key} onClick={() => toggle(item.key)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface transition-colors active:scale-[0.98]">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-all',
              checklist?.[item.key] ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white')}>
              {checklist?.[item.key] && <Check className="h-4 w-4 text-white" />}
            </div>
            <span className="text-xl">{item.icon}</span>
            <span className={cn('text-sm font-medium flex-1 text-left',
              checklist?.[item.key] ? 'text-muted line-through' : 'text-text')}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {pct === 100 && !checklist?.is_closed && (
        <button onClick={() => toggle('is_closed')}
          className="btn btn-accent btn-full py-4 text-base gap-2">
          <CheckCircle className="h-5 w-5" />Mark Store Closed for Today
        </button>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/timeline').then(r => r.json()).then(d => { setEvents(d.events || []); setLoading(false); });
  }, []);

  const TYPE_ICONS: Record<string, string> = {
    clock_in: '🕐', clock_out: '🕐', delivery: '🚚', safe_drop: '🔒',
    paid_out: '💸', invoice: '📄', report_upload: '📊', ai_alert: '🤖',
    deposit: '🏦', sale: '💰', order: '📦', default: '📍',
  };

  const TYPE_COLORS: Record<string, string> = {
    clock_in: 'bg-blue-50 border-blue-200', clock_out: 'bg-blue-50 border-blue-200',
    delivery: 'bg-green-50 border-green-200', safe_drop: 'bg-gray-50 border-gray-200',
    paid_out: 'bg-red-50 border-red-200', invoice: 'bg-purple-50 border-purple-200',
    report_upload: 'bg-accent/5 border-accent/20', ai_alert: 'bg-violet-50 border-violet-200',
    deposit: 'bg-green-50 border-green-200', default: 'bg-gray-50 border-gray-200',
  };

  if (loading) return <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <div className="tile p-10 text-center">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-700 mb-1">No events yet today</p>
          <p className="text-gray-400 text-sm">Events appear as the day unfolds — clock-ins, deliveries, safe drops, report uploads, and more</p>
        </div>
      ) : (
        <div className="relative pl-8">
          {/* Timeline line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
          {events.map((ev, i) => (
            <div key={ev.id || i} className="relative mb-4">
              <div className={cn('absolute -left-4.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white', 'border-gray-300')} style={{ top: '50%', transform: 'translateY(-50%)' }}>
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              </div>
              <div className={cn('rounded-xl border p-4 ml-2', TYPE_COLORS[ev.type] || TYPE_COLORS.default)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_ICONS[ev.type] || TYPE_ICONS.default}</span>
                    <div>
                      <p className="text-sm font-semibold text-text">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted mt-0.5">{ev.description}</p>}
                      {ev.employee_name && <p className="text-xs text-muted">by {ev.employee_name}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted">{fmtTime(ev.event_time)}</p>
                    {ev.amount > 0 && <p className="num text-sm font-bold text-text">{fmt.currency(ev.amount)}</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({ date, onSuccess }: { date: string; onSuccess: (d: any) => void }) {
  const [uploads, setUploads] = useState<{ type: string; warnings: string[] }[]>([]);

  const handleResult = (data: any) => {
    setUploads(p => [...p, { type: data.reportType || 'unknown', warnings: data.warnings || [] }]);
    onSuccess(data);
    // Auto log to timeline
    fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'report_upload', title: `${(data.reportType || 'Report').replace('_', ' ')} uploaded`, description: data.warnings?.length > 0 ? `${data.warnings.length} issue(s) detected` : 'Processed successfully' }) }).catch(() => {});
  };

  return (
    <div className="tile p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
          <BarChart3 className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-bold text-text">Upload Reports</p>
          <p className="text-xs text-muted mt-0.5">AI identifies report type automatically. Upload multiple — everything merges into one daily report.</p>
        </div>
      </div>
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
        <p className="text-xs text-blue-700 font-medium">Store Close · Till · Lottery · Scratch Off · Department · Safe Drop · Paid Out · Paid In · Fuel · PLU · Summary</p>
      </div>
      <MultiScan endpoint="/api/scan-daily-report" onResult={handleResult}
        title="Scan or Upload Report" hint="Photo or PDF — AI reads type and all numbers instantly"
        extraFields={{ report_date: date }} />
      {uploads.map((u, i) => (
        <div key={i} className={cn('rounded-xl px-4 py-3 flex items-center gap-2 text-sm',
          u.warnings.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200')}>
          {u.warnings.length > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> : <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />}
          <span className={u.warnings.length > 0 ? 'text-amber-800' : 'text-green-800'}>
            <b className="capitalize">{u.type.replace('_', ' ')}</b> processed
            {u.warnings.length > 0 && ` · ${u.warnings.length} warning${u.warnings.length > 1 ? 's' : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DailyReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('report');
  const [todayReport, setTodayReport] = useState<any>(null);
  const [prevReports, setPrevReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
        sb.from('daily_reports').select('*').eq('store_id', store.id).lt('report_date', today).order('report_date', { ascending: false }).limit(14),
      ]);
      setTodayReport(tr || null);
      setPrevReports(prev || []);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [store]);

  useEffect(() => { if (mounted && store) loadData(); }, [mounted, store, loadData]);

  if (!mounted) return null;

  const today = todayStr();
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const TABS: { id: Tab; label: string }[] = [
    { id: 'report',    label: '📊 Reports'   },
    { id: 'checklist', label: '✅ Checklist'  },
    { id: 'timeline',  label: '📅 Timeline'  },
  ];

  return (
    <Screen title="Daily Reports" subtitle={todayLabel}
      action={
        <button onClick={() => { setRefreshing(true); loadData(); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      }>
      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Report tab */}
        {tab === 'report' && (
          loading ? (
            <div className="tile p-10 text-center"><RefreshCw className="h-8 w-8 text-accent animate-spin mx-auto" /></div>
          ) : (
            <>
              {todayReport ? (
                <>
                  <ReportCard report={todayReport}
                    onDelete={() => { setTodayReport(null); setShowAddMore(false); loadData(); }}
                    onRefresh={loadData} />
                  <button onClick={() => setShowAddMore(v => !v)}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-4 text-sm font-semibold text-muted hover:border-accent hover:text-accent transition-colors">
                    <Plus className="h-4 w-4" />{showAddMore ? 'Hide upload' : 'Add more reports to today'}
                  </button>
                  {showAddMore && <UploadZone date={today} onSuccess={loadData} />}
                </>
              ) : (
                <>
                  <div className="tile p-8 text-center border-2 border-dashed border-gray-200">
                    <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p className="font-bold text-gray-700 text-lg mb-1">No report yet today</p>
                    <p className="text-gray-400 text-sm">Upload any close report — AI identifies type and extracts all numbers automatically</p>
                  </div>
                  <UploadZone date={today} onSuccess={(data) => { if (data.report) setTodayReport(data.report); loadData(); }} />
                </>
              )}

              {prevReports.length > 0 && (
                <div>
                  <p className="section-title">Previous Reports</p>
                  <div className="space-y-3">
                    {prevReports.map(r => <ReportCard key={r.id} report={r} onDelete={loadData} onRefresh={loadData} />)}
                  </div>
                </div>
              )}
            </>
          )
        )}

        {tab === 'checklist' && store && <ClosingChecklist storeId={store.id} />}
        {tab === 'timeline' && <Timeline />}
      </div>
    </Screen>
  );
}
