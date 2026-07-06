'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Users, RefreshCw } from 'lucide-react';

export default function PerformancePage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [clocks, setClocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: emps }, { data: tc }] = await Promise.all([
      sb.from('employees').select('*').eq('store_id', store.id).eq('is_active', true),
      sb.from('time_clock').select('*').eq('store_id', store.id).gte('clock_in', monthAgo).not('clock_out', 'is', null),
    ]);
    setEmployees(emps || []);
    setClocks(tc || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) load(); }, [mounted, store, load]);

  if (!mounted) return null;

  const perf = employees.map(emp => {
    const shifts = clocks.filter(c => c.employee_id === emp.id);
    const totalHrs = shifts.reduce((s, c) => s + (c.hours_worked || 0), 0);
    const avgHrs = shifts.length ? totalHrs / shifts.length : 0;
    const rate = emp.hourly_rate || 0;
    const totalPay = rate * totalHrs;
    return { emp, shifts: shifts.length, totalHrs, avgHrs, totalPay };
  }).sort((a, b) => b.totalHrs - a.totalHrs);

  const totalLaborCost = perf.reduce((s, p) => s + p.totalPay, 0);
  const totalHours = perf.reduce((s, p) => s + p.totalHrs, 0);

  return (
    <Screen title="Employee Performance" subtitle="Last 30 days">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">Total Hours</p>
            <p className="num font-black text-2xl text-text">{totalHours.toFixed(1)}h</p>
          </div>
          <div className="tile p-4 text-center">
            <p className="text-xs text-muted">Labor Cost</p>
            <p className="num font-black text-2xl text-text">{fmt.currency(totalLaborCost)}</p>
          </div>
        </div>

        {loading && <div className="tile p-8 text-center"><RefreshCw className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

        {!loading && perf.length === 0 && (
          <div className="tile p-10 text-center"><Users className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted">No employee data yet</p></div>
        )}

        {perf.map(({ emp, shifts, totalHrs, avgHrs, totalPay }) => (
          <div key={emp.id} className="tile p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white font-black text-lg">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-text">{emp.name}</p>
                  <p className="text-xs text-muted">{emp.role}</p>
                </div>
              </div>
              <p className="num font-black text-xl text-text">{fmt.currency(totalPay)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Shifts</p>
                <p className="num font-bold text-text">{shifts}</p>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Total Hrs</p>
                <p className="num font-bold text-text">{totalHrs.toFixed(1)}</p>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <p className="text-[10px] text-muted">Avg Shift</p>
                <p className="num font-bold text-text">{avgHrs.toFixed(1)}h</p>
              </div>
            </div>
            {emp.hourly_rate && (
              <p className="text-xs text-muted mt-2">{fmt.currency(emp.hourly_rate)}/hr · {totalHrs > 40 ? <span className="text-amber-600">{(totalHrs-40).toFixed(1)}h overtime</span> : 'No overtime'}</p>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}
