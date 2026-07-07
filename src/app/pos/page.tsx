'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  Loader2, ChevronDown, ChevronUp, Trash2, RefreshCw,
  DollarSign, Zap, CheckCircle, AlertTriangle, TrendingDown, TrendingUp, Info
} from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';

// ── helpers ──────────────────────────────────────────────────────────────────
const n = (v: any) => Number(v || 0);

function fmtDateShort(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
}
function fmtDateLong(d: string) {
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

// ── Row component ─────────────────────────────────────────────────────────────
function Row({ label, value, sub, red, bold, indent }: {
  label: string; value: number; sub?: string; red?: boolean; bold?: boolean; indent?: boolean;
}) {
  if (value === 0) return null;
  return (
    <div className={cn('flex items-center justify-between py-2 border-b border-gray-50 last:border-0', indent && 'pl-4')}>
      <div>
        <span className={cn('text-sm', bold ? 'font-bold text-text' : 'text-gray-600')}>{label}</span>
        {sub && <p className="text-[10px] text-muted">{sub}</p>}
      </div>
      <span className={cn('num text-sm font-bold', bold ? 'text-text' : red ? 'text-red-600' : 'text-gray-800')}>
        {red ? '-' : ''}{fmt.currency(Math.abs(value))}
      </span>
    </div>
  );
}

// ── Cash Count + Short/Over ───────────────────────────────────────────────────
function CashCount({ safeDrops, reportDate, existingCount, onUpdate }: {
  safeDrops: number; reportDate: string; existingCount: number; onUpdate?: () => void;
}) {
  const [cashInput, setCashInput] = useState('');
  const [counting, setCounting] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Already counted — show result
  const alreadyCounted = existingCount > 0;
  const diff = alreadyCounted ? Math.round((existingCount - safeDrops) * 100) / 100 : null;
  const isShort = diff !== null && diff < -0.50;
  const isOver  = diff !== null && diff > 0.50;
  const isGood  = diff !== null && !isShort && !isOver;

  const submit = async () => {
    if (!cashInput || !reportDate) return;
    setCounting(true);
    try {
      const res = await fetch('/api/count-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counted_cash: parseFloat(cashInput), report_date: reportDate }),
      });
      const data = await res.json();
      if (data.success) { setResult(data); onUpdate?.(); }
      else setResult({ error: data.error || 'Failed' });
    } catch { setResult({ error: 'Network error — try again' }); }
    setCounting(false);
  };

  if (safeDrops === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-muted">No safe drops recorded yet</p>
        <p className="text-xs text-muted">Upload your till report to see safe drop total</p>
      </div>
    );
  }

  // Show previous count result
  if (alreadyCounted && !result) {
    return (
      <div className={cn('rounded-2xl border-2 p-5',
        isShort ? 'border-red-400 bg-red-50' :
        isOver  ? 'border-blue-400 bg-blue-50' :
                  'border-green-400 bg-green-50')}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{color: isShort?'#b91c1c':isOver?'#1d4ed8':'#15803d'}}>
          CASH COUNT RESULT
        </p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className={cn('num font-black text-5xl leading-none', isShort?'text-red-700':isOver?'text-blue-700':'text-green-700')}>
              {isOver?'+':''}{fmt.currency(diff!)}
            </p>
            <p className={cn('text-sm font-bold mt-2', isShort?'text-red-600':isOver?'text-blue-600':'text-green-600')}>
              {isShort ? `⚠ Safe is ${fmt.currency(Math.abs(diff!))} SHORT` :
               isOver  ? `Safe is ${fmt.currency(diff!)} OVER` :
               '✓ Cash matches safe drops perfectly'}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div><p className="text-[10px] text-gray-500">Safe Drops</p><p className="num font-bold">{fmt.currency(safeDrops)}</p></div>
            <div><p className="text-[10px] text-gray-500">You Counted</p><p className="num font-bold">{fmt.currency(existingCount)}</p></div>
          </div>
        </div>
        <button onClick={() => { setResult(null); setCashInput(''); }}
          className="text-xs text-muted hover:text-sub underline">
          Recount cash
        </button>
      </div>
    );
  }

  // Show submitted result
  if (result && !result.error) {
    return (
      <div className={cn('rounded-2xl border-2 p-5',
        result.status==='balanced' ? 'border-green-400 bg-green-50' :
        result.status==='short'    ? 'border-red-400 bg-red-50' :
                                     'border-blue-400 bg-blue-50')}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
           style={{color:result.status==='balanced'?'#15803d':result.status==='short'?'#b91c1c':'#1d4ed8'}}>
          CASH COUNT RESULT
        </p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className={cn('num font-black text-5xl leading-none',
              result.status==='balanced'?'text-green-700':result.status==='short'?'text-red-700':'text-blue-700')}>
              {(result.short_over||0)>=0?'+':''}{fmt.currency(result.short_over||0)}
            </p>
            <p className={cn('text-sm font-bold mt-2',
              result.status==='balanced'?'text-green-600':result.status==='short'?'text-red-600':'text-blue-600')}>
              {result.status==='balanced' ? '✓ Perfect — cash matches safe drops!' :
               result.status==='short'    ? `⚠ Safe is ${fmt.currency(Math.abs(result.short_over||0))} SHORT` :
                                            `Safe is ${fmt.currency(result.short_over||0)} OVER`}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div><p className="text-[10px] text-gray-500">Safe Drops</p><p className="num font-bold">{fmt.currency(result.expected||0)}</p></div>
            <div><p className="text-[10px] text-gray-500">You Counted</p><p className="num font-bold">{fmt.currency(result.counted||0)}</p></div>
          </div>
        </div>

        {result.ai_reason && (
          <div className="rounded-xl bg-white/60 p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-violet-600"/>
              <p className="text-xs font-bold text-violet-700">AI Analysis</p>
            </div>
            <p className="text-xs text-gray-700">{result.ai_reason}</p>
          </div>
        )}

        {result.ai_suggestions?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-gray-700">What to check:</p>
            {result.ai_suggestions.map((s:string,i:number) => (
              <div key={i} className="flex gap-2 text-xs text-gray-600">
                <span className="font-black text-accent shrink-0">{i+1}.</span><span>{s}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => { setResult(null); setCashInput(''); }}
          className="mt-3 text-xs text-muted hover:text-sub underline">Recount</button>
      </div>
    );
  }

  // Input form
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">COUNT YOUR CASH</p>
      <p className="text-xs text-amber-700 mb-1">
        Safe drops total: <span className="num font-black text-text">{fmt.currency(safeDrops)}</span>
      </p>
      <p className="text-xs text-amber-600 mb-4">
        Count all cash physically in the safe (safe drops only — don't include the $250 beginning till).
        Enter what you count below.
      </p>
      {result?.error && <p className="text-xs text-red-600 mb-3">{result.error}</p>}
      <div className="flex gap-2">
        <input
          type="number" step="0.01" min="0"
          value={cashInput}
          onChange={e => setCashInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder="0.00" autoFocus
          className="inp num font-black text-2xl text-center flex-1 h-14"
        />
        <button onClick={submit} disabled={!cashInput||counting}
          className={cn('btn btn-accent h-14 px-6 font-bold gap-2', counting&&'opacity-60')}>
          {counting ? <><Loader2 className="h-4 w-4 animate-spin"/>Checking…</> : 'Submit'}
        </button>
      </div>
    </div>
  );
}

// ── Full Report View ──────────────────────────────────────────────────────────
function ReportCard({ report, onDelete, onRefresh }: {
  report: any; onDelete: ()=>void; onRefresh: ()=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    setDeleting(true);
    await fetch(`/api/daily-report?id=${report.id}`, { method: 'DELETE' }).catch(()=>{});
    setDeleting(false);
    onDelete();
  };

  // All the numbers
  const grossSales      = n(report.gross_sales);
  const fuelSales       = n(report.fuel_sales);
  const insideSales     = n(report.inside_sales);
  const taxes           = n(report.taxes);
  const discounts       = n(report.discounts);
  const lotterySales    = n(report.lottery_sales);
  const scratchSales    = n(report.scratch_sales);
  const lotteryPayouts  = n(report.lottery_payouts);
  const scratchPayouts  = n(report.scratch_payouts);
  const lotterySettlement = n(report.lottery_settlement);
  const lotteryCommission = n(report.lottery_commission);
  const safeDrops       = n(report.safe_drops);
  const safeLoans       = n(report.safe_loans);
  const paidOuts        = n(report.paid_outs);
  const paidIns         = n(report.paid_ins);
  const creditSales     = n(report.credit_sales);
  const debitSales      = n(report.debit_sales);
  const checkSales      = n(report.check_sales); // card settlement
  const ebtSales        = n(report.ebt_sales);
  const actualCash      = n(report.actual_cash);
  const shortOver       = n(report.drawer_difference);
  const depts           = Object.entries(report.department_sales||{}).filter(([,v])=>Number(v)!==0).sort((a,b)=>Math.abs(Number(b[1]))-Math.abs(Number(a[1])));
  const checksGiven: any[] = Array.isArray(report.checks_given) ? report.checks_given : [];

  // Status chip
  const statusColor = shortOver < -0.50 ? 'bg-red-100 text-red-700' :
                      shortOver > 0.50  ? 'bg-blue-100 text-blue-700' :
                      actualCash > 0    ? 'chip-green' : 'bg-amber-100 text-amber-700';
  const statusText  = shortOver < -0.50 ? `⚠ Short ${fmt.currency(Math.abs(shortOver))}` :
                      shortOver > 0.50  ? `Over ${fmt.currency(shortOver)}` :
                      actualCash > 0    ? '✓ Balanced' : 'Count cash';

  return (
    <div className="tile overflow-hidden">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="font-black text-xl text-text">{fmtDateShort(report.report_date)}</p>
              <span className={cn('chip text-xs font-bold', statusColor)}>{statusText}</span>
            </div>
            <p className="text-xs text-muted">{fmtDateLong(report.report_date)}</p>
          </div>
          <div className="text-right">
            <p className="num font-black text-3xl text-text">{fmt.currency(grossSales)}</p>
            <p className="text-xs text-muted">Gross Sales</p>
          </div>
        </div>

        {/* Top 4 KPIs */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Fuel',      value: fuelSales },
            { label: 'Inside',    value: insideSales },
            { label: 'Tax',       value: taxes },
            { label: 'Lottery',   value: lotterySales + scratchSales },
          ].map(k => (
            <div key={k.label} className="rounded-xl bg-surface p-2.5 text-center">
              <p className="text-[10px] text-muted">{k.label}</p>
              <p className="num font-bold text-text text-sm">{k.value > 0 ? fmt.currency(k.value) : '—'}</p>
            </div>
          ))}
        </div>

        {/* Cash Count — THE ONLY MANUAL STEP */}
        <CashCount
          safeDrops={safeDrops}
          reportDate={report.report_date}
          existingCount={actualCash}
          onUpdate={onRefresh}
        />
      </div>

      {/* ── EXPAND BUTTON ───────────────────────────────────────────────── */}
      <button onClick={() => setExpanded(v=>!v)}
        className="w-full flex items-center justify-center gap-2 py-3 border-t border-border text-xs font-semibold text-muted hover:text-sub transition-colors">
        {expanded ? <><ChevronUp className="h-4 w-4"/>Hide full report</> : <><ChevronDown className="h-4 w-4"/>View full report</>}
      </button>

      {/* ── FULL DETAIL ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border">

          {/* IN */}
          <div className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 rounded-lg px-3 py-1.5 inline-block mb-4">↑ IN — All Income</p>
            <Row label="Fuel Amount"           value={fuelSales} bold />
            <Row label="Total Merchandise"     value={insideSales} bold />
            <Row label="  Taxable Sales"       value={insideSales - taxes} indent />
            <Row label="  Non-Taxable Sales"   value={ebtSales} indent />
            <Row label="Sales Tax Collected"   value={taxes} />
            <Row label="Lottery Sales"         value={lotterySales} />
            <Row label="Scratch Off Sales"     value={scratchSales} />
            <Row label="Lottery Net Settlement" value={lotterySettlement}
              sub={lotteryCommission > 0 ? `Commission: ${fmt.currency(lotteryCommission)}` : undefined} />
            <Row label="EBT / Food Stamps"     value={ebtSales} />
            <Row label="Money From Bank (Safe Loan)" value={safeLoans} />
            <Row label="Paid In"               value={paidIns} />
          </div>

          {/* OUT */}
          <div className="p-5 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 bg-red-50 rounded-lg px-3 py-1.5 inline-block mb-4">↓ OUT — All Expenses & Payouts</p>
            <Row label="Lotto Cashes Paid"     value={lotteryPayouts} red />
            <Row label="Scratch Off Cashes"    value={scratchPayouts} red />
            <Row label="Paid Out (Cash)"       value={paidOuts} red />
            {checksGiven.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mt-3 mb-2">Vendor Checks Written</p>
                {checksGiven.map((c:any,i:number) => (
                  <div key={i} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">{c.payee||c.vendor||'Vendor'}{c.number?` #${c.number}`:''}</span>
                    <span className="num text-sm font-bold text-red-600">-{fmt.currency(Number(c.amount||0))}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Daily Closing — Modisoft style */}
          <div className="p-5 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">DAILY CLOSING</p>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm font-bold text-text">Daily Closing Cash (Safe Drops)</span>
                <span className="num text-sm font-black text-text">{fmt.currency(safeDrops)}</span>
              </div>
              {actualCash > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">You Physically Counted</span>
                  <span className="num text-sm font-bold">{fmt.currency(actualCash)}</span>
                </div>
              )}
              {checkSales > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Daily Closing Check (Card Settlement)</span>
                  <span className="num text-sm font-bold">{fmt.currency(checkSales)}</span>
                </div>
              )}
              {shortOver !== 0 && actualCash > 0 && (
                <div className={cn('flex justify-between py-3 rounded-xl px-3 mt-2 font-bold',
                  shortOver < 0 ? 'bg-red-100' : 'bg-green-100')}>
                  <span className={cn('text-sm', shortOver < 0 ? 'text-red-700' : 'text-green-700')}>
                    {shortOver < 0 ? '⚠ SHORT / OVER' : 'SHORT / OVER'}
                  </span>
                  <span className={cn('num text-sm', shortOver < 0 ? 'text-red-700' : 'text-green-700')}>
                    {shortOver > 0 ? '+' : ''}{fmt.currency(shortOver)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Methods */}
          {(creditSales + debitSales + checkSales + ebtSales + safeDrops) > 0 && (
            <div className="p-5 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">HOW CUSTOMERS PAID</p>
              <div className="space-y-0">
                <Row label="Credit / CRIND (pump + inside)" value={creditSales} />
                <Row label="Card Settlement (Check)" value={checkSales} sub="Bank ACH batch for all card transactions" />
                <Row label="Debit" value={debitSales} />
                <Row label="EBT / Food Stamps" value={ebtSales} />
                <Row label="Cash (Safe Drops)" value={safeDrops} />
              </div>
            </div>
          )}

          {/* Fuel breakdown */}
          {(n(report.fuel_unleaded_sales)+n(report.fuel_midgrade_sales)+n(report.fuel_premium_sales)+n(report.fuel_diesel_sales)) > 0 && (
            <div className="p-5 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">FUEL BY GRADE</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Unleaded', s:n(report.fuel_unleaded_sales), g:n(report.fuel_unleaded_gallons) },
                  { label:'Midgrade', s:n(report.fuel_midgrade_sales), g:n(report.fuel_midgrade_gallons) },
                  { label:'Regular+', s:n(report.fuel_premium_sales),  g:n(report.fuel_premium_gallons) },
                  { label:'Diesel',   s:n(report.fuel_diesel_sales),   g:n(report.fuel_diesel_gallons) },
                ].filter(g=>g.s>0).map(g=>(
                  <div key={g.label} className="rounded-xl bg-surface p-3">
                    <p className="text-[10px] text-muted">{g.label}</p>
                    <p className="num font-black text-text">{fmt.currency(g.s)}</p>
                    {g.g>0 && <p className="text-[10px] text-muted">{g.g.toFixed(3)} gal</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department Sales */}
          {depts.length > 0 && (
            <div className="p-5 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">DEPARTMENT SALES ({depts.length})</p>
              <div className="space-y-0">
                {depts.map(([dept,val])=>{
                  const v = Number(val);
                  const pct = insideSales > 0 ? (Math.abs(v)/insideSales*100) : 0;
                  return (
                    <div key={dept} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600 flex-1 capitalize">{dept.toLowerCase().replace(/_/g,' ')}</span>
                      <span className="text-xs text-muted w-12 text-right">{pct.toFixed(1)}%</span>
                      <span className={cn('num text-sm font-bold w-20 text-right', v<0?'text-red-600':'text-text')}>{fmt.currency(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Notes */}
          {report.ai_notes && (
            <div className="p-5 border-t border-border">
              <div className="rounded-xl bg-violet-50 border border-violet-200 p-4">
                <div className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-violet-600"/><p className="text-sm font-bold text-violet-800">Auto-Processed</p></div>
                <p className="text-sm text-violet-700">{report.ai_notes}</p>
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="p-5 border-t border-border">
            <button onClick={doDelete} disabled={deleting}
              className="btn btn-ghost w-full border border-red-200 text-red-500 hover:bg-red-50 gap-2 py-3">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
              Delete this report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PosPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanSuccess, setScanSuccess] = useState<string|null>(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const weekAgo = new Date(Date.now()-7*86400000).toISOString().split('T')[0];
    const { data } = await createClient().from('daily_reports').select('*')
      .eq('store_id', store.id)
      .gte('report_date', weekAgo)
      .order('report_date', { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;

  const handleScanResult = (data: any) => {
    if (data?.success) {
      const type = data.reportType || 'report';
      const msg = [
        `✓ ${type.replace(/_/g,' ')} read for ${data.reportDate}`,
        data.deliveriesLogged > 0 ? `${data.deliveriesLogged} deliveries → Invoices` : null,
        data.checksFound > 0 ? `${data.checksFound} vendor checks → Invoices` : null,
      ].filter(Boolean).join(' · ');
      setScanSuccess(msg);
      setTimeout(() => setScanSuccess(null), 5000);
      if (data.reportDate) setSelectedDate(data.reportDate);
    }
    load();
  };

  const dateReports = reports.filter(r => r.report_date === selectedDate);
  const otherReports = reports.filter(r => r.report_date !== selectedDate);

  return (
    <Screen title="Daily Reports" subtitle="Scan any report — everything fills in automatically">
      <div className="space-y-5">

        {/* How it works banner */}
        <div className="rounded-2xl bg-gradient-to-r from-accent/10 to-violet-500/10 border border-accent/20 p-4">
          <p className="text-sm font-bold text-text mb-1">How it works</p>
          <div className="space-y-1">
            {[
              { step: '1', text: 'Scan or upload any close report — AI reads all numbers automatically', done: true },
              { step: '2', text: 'All sections update: Tax, Fuel, Trends, P&L, Inventory', done: true },
              { step: '3', text: 'Count cash in safe → app shows short or over instantly', done: false },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-2.5 text-xs text-gray-700">
                <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  s.done ? 'bg-accent text-white' : 'bg-amber-400 text-white')}>
                  {s.step}
                </div>
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scan success message */}
        {scanSuccess && (
          <div className="rounded-2xl bg-green-50 border-2 border-green-400 px-4 py-3 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-800">{scanSuccess}</p>
          </div>
        )}

        {/* Date picker */}
        <div className="flex gap-2">
          <input type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="inp flex-1 h-10 text-sm" />
          <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Upload scanner */}
        <MultiScan
          endpoint="/api/scan-daily-report"
          extraFields={{ report_date: selectedDate }}
          onResult={handleScanResult}
          title="Upload Reports"
          hint="Store Close · Till · Lottery · Scratch Off · Department · Handwritten · Fuel · Any format"
        />

        {/* Info box about what auto-updates */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-blue-800 mb-1">When you upload a report, these update automatically:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {['Tax Reports', 'Annual Trends', 'Reports & P&L', 'Fuel Margins',
                  'Vendor Invoices', 'Bank Reconciliation', 'Home Dashboard', 'AI Ordering'].map(s => (
                  <p key={s} className="text-[11px] text-blue-700">✓ {s}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && <div className="tile p-8 text-center"><Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {/* Selected date report */}
        {!loading && dateReports.length === 0 && (
          <div className="tile p-10 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold text-text mb-1">
              No report for {fmtDateShort(selectedDate)}
            </p>
            <p className="text-sm text-muted">Upload any report above — AI fills everything automatically</p>
          </div>
        )}

        {!loading && dateReports.map(r => (
          <ReportCard key={r.id} report={r} onDelete={load} onRefresh={load} />
        ))}

        {/* Previous days */}
        {!loading && otherReports.length > 0 && (
          <div className="space-y-4">
            <p className="section-title">Previous Days</p>
            {otherReports.map(r => (
              <ReportCard key={r.id} report={r} onDelete={load} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
