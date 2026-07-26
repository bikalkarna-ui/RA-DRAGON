'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { RefreshCw, Check, X, DollarSign } from 'lucide-react';

export default function BankPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [reports, setReports] = useState<any[]>([]);
  const [bankAmounts, setBankAmounts] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const weekAgo = new Date(Date.now()-14*86400000).toISOString().split('T')[0];
    const { data } = await createClient().from('daily_reports').select('*').eq('store_id', store.id).gte('report_date', weekAgo).order('report_date', { ascending: false });
    setReports(data || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;
  const n = (v: any) => Number(v || 0);

  return (
    <Screen title="Bank Reconciliation" subtitle="Match deposits to daily cash totals">
      <div className="space-y-4">
        <div className="tile p-4 bg-blue-50 border border-blue-200">
          <p className="text-sm font-bold text-blue-800 mb-1">How to use</p>
          <p className="text-xs text-blue-700">Enter the amount that actually hit your bank account for each day. The app compares it to what POS says you should have deposited.</p>
        </div>

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {reports.map(r => {
          const expected = n(r.cash_sales) - n(r.safe_loans) + n(r.check_sales);
          const actual = parseFloat(bankAmounts[r.report_date] || '0') || 0;
          const diff = Math.round((actual - expected) * 100) / 100;
          const hasInput = !!bankAmounts[r.report_date];
          return (
            <div key={r.id} className="tile p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-text">{(() => { try { return new Date(r.report_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}); } catch { return r.report_date; } })()}</p>
                  <p className="text-xs text-muted">POS Cash: {fmt.currency(n(r.cash_sales))} · Deposit: {fmt.currency(expected)}</p>
                </div>
                {hasInput && (
                  <div className={cn('flex items-center gap-1.5 text-sm font-bold',
                    Math.abs(diff) < 0.50 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-blue-600')}>
                    {Math.abs(diff) < 0.50 ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {diff >= 0 ? '+' : ''}{fmt.currency(diff)}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input type="number" step="0.01" min="0"
                    value={bankAmounts[r.report_date] || ''}
                    onChange={e => setBankAmounts(p => ({ ...p, [r.report_date]: e.target.value }))}
                    placeholder="Bank deposit amount"
                    className="inp pl-9 num" />
                </div>
              </div>
              {hasInput && Math.abs(diff) > 0.50 && (
                <p className="text-xs text-red-600 mt-2">
                  {diff < 0 ? `⚠ Bank shows ${fmt.currency(Math.abs(diff))} less than expected — check for missing deposit` : `Bank shows ${fmt.currency(diff)} more than expected`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
