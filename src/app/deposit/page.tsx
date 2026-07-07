'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Download, Printer } from 'lucide-react';

export default function DepositPage() {
  const [mounted, setMounted] = useState(false);
  const { store, storeData } = useStore();
  const [report, setReport] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const { data } = await createClient().from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', date).maybeSingle();
    setReport(data);
    setLoading(false);
  }, [store, date]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, date, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);

  const cashToDeposit = n(report?.cash_sales) - n(report?.safe_loans);
  const checkTotal = n(report?.check_sales);
  const totalDeposit = cashToDeposit + checkTotal;

  const handlePrint = () => window.print();

  return (
    <Screen title="Cash Deposit Slip" subtitle="Generate deposit slip from daily report">
      <div className="space-y-4">
        <div className="tile p-4">
          <label className="lbl">Select date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="inp" />
        </div>

        {!report && !loading && (
          <div className="tile p-8 text-center"><p className="text-muted">No report found for {date}</p></div>
        )}

        {report && (
          <div id="deposit-slip" className="tile overflow-hidden">
            {/* Header */}
            <div className="bg-accent text-white p-6 text-center">
              <p className="font-black text-xl">{storeData?.name || 'Store'}</p>
              <p className="text-sm opacity-80 mt-1">Cash Deposit Slip</p>
              <p className="text-sm opacity-80">{(() => { try { return new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}); } catch { return date; } })()}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Currency breakdown */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Currency</p>
                <div className="space-y-2">
                  {[
                    { label: 'Cash Sales (POS)', amount: n(report.cash_sales) },
                    { label: 'Less: Safe Loans', amount: -n(report.safe_loans) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={cn("num text-sm font-semibold", row.amount < 0 ? 'text-red-600' : 'text-text')}>
                        {row.amount < 0 ? '-' : ''}{fmt.currency(Math.abs(row.amount))}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 border-b-2 border-text">
                    <span className="text-sm font-bold text-text">Cash to Deposit</span>
                    <span className="num text-sm font-black text-text">{fmt.currency(cashToDeposit)}</span>
                  </div>
                </div>
              </div>

              {/* Checks */}
              {checkTotal > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Checks</p>
                  {(report.checks_given || []).map((c: any, i: number) => (
                    <div key={i} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">#{c.number} {c.payee}</span>
                      <span className="num text-sm font-semibold">{fmt.currency(c.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-sm font-bold text-text">Check Total</span>
                    <span className="num text-sm font-bold text-text">{fmt.currency(checkTotal)}</span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="rounded-2xl bg-accent/5 border-2 border-accent p-4">
                <div className="flex justify-between items-center">
                  <span className="font-black text-text text-lg">TOTAL DEPOSIT</span>
                  <span className="num font-black text-3xl text-accent">{fmt.currency(totalDeposit)}</span>
                </div>
              </div>

              {/* Signature lines */}
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="border-t-2 border-gray-300 pt-2">
                  <p className="text-xs text-muted text-center">Prepared By</p>
                </div>
                <div className="border-t-2 border-gray-300 pt-2">
                  <p className="text-xs text-muted text-center">Verified By</p>
                </div>
              </div>

              <p className="text-xs text-muted text-center">{storeData?.name} · {date} · Generated by RYXSOR AI</p>
            </div>
          </div>
        )}

        {report && (
          <div className="flex gap-3">
            <button onClick={handlePrint} className="btn btn-accent flex-1 gap-2 py-3">
              <Printer className="h-5 w-5" />Print Deposit Slip
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}
