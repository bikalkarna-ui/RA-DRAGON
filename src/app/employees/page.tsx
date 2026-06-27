'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Users, Clock, LogIn, LogOut, Check, Plus, X, Eye, EyeOff, Trash2, Download, Loader2, TrendingUp } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';

type Tab = 'clock' | 'staff' | 'payroll';

export default function EmployeesPage() {
  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('clock');
  const [employees, setEmployees] = useState<any[]>([]);
  const [clockRecords, setClockRecords] = useState<any[]>([]);
  const [clockedIn, setClockedIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinMsg, setPinMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', pin: '', role: 'cashier', hourly_rate: '' });
  const [showPins, setShowPins] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const from = startOfMonth(new Date()).toISOString();
    const [{ data: emps }, { data: clocks }] = await Promise.all([
      sb.from('employees').select('*').eq('store_id', store.id).order('name'),
      sb.from('time_clock').select('*').eq('store_id', store.id).gte('clock_in', from).order('clock_in', { ascending: false }),
    ]);
    setEmployees(emps ?? []);
    setClockRecords(clocks ?? []);
    // Find who's clocked in
    const open = new Set((clocks ?? []).filter((c: any) => !c.clock_out).map((c: any) => c.employee_id));
    setClockedIn(open);
    setLoading(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  const handlePinAction = async () => {
    if (pinInput.length < 4) return;
    setProcessing(true); setPinMsg(null);
    try {
      const emp = employees.find(e => e.pin === pinInput && e.is_active);
      if (!emp) { setPinMsg({ text: 'Wrong PIN — try again', ok: false }); return; }

      const action = clockedIn.has(emp.id) ? 'clock_out' : 'clock_in';
      const res = await fetch('/api/time-clock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employee_id: emp.id, employee_name: emp.name }),
      });
      const data = await res.json();
      if (!res.ok) { setPinMsg({ text: data.error, ok: false }); return; }

      if (action === 'clock_in') {
        setPinMsg({ text: `✓ ${emp.name} clocked IN at ${format(new Date(), 'h:mm a')}`, ok: true });
      } else {
        const hrs = data.hours_worked?.toFixed(2) ?? '0';
        setPinMsg({ text: `✓ ${emp.name} clocked OUT — ${hrs} hours`, ok: true });
      }
      setPinInput('');
      load();
    } catch { setPinMsg({ text: 'Error — try again', ok: false }); }
    finally { setProcessing(false); setTimeout(() => setPinMsg(null), 4000); }
  };

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault(); setFormErr('');
    if (form.pin.length < 4) { setFormErr('PIN must be at least 4 digits'); return; }
    if (employees.find(emp => emp.pin === form.pin && emp.is_active)) { setFormErr('That PIN is already in use'); return; }
    setSaving(true);
    const { error } = await createClient().from('employees').insert({ store_id: store?.id, name: form.name, email: form.email || null, pin: form.pin, role: form.role, hourly_rate: parseFloat(form.hourly_rate) || null });
    setSaving(false);
    if (error) { setFormErr(error.message); return; }
    setForm({ name: '', email: '', pin: '', role: 'cashier', hourly_rate: '' });
    setShowForm(false); load();
  };

  const delEmployee = async (id: string) => {
    if (!confirm('Remove this employee?')) return;
    await createClient().from('employees').delete().eq('id', id);
    load();
  };

  const toggleActive = async (emp: any) => {
    await createClient().from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id);
    load();
  };

  // Payroll calc
  const payrollData = employees.filter(e => e.hourly_rate > 0).map(emp => {
    const empClocks = clockRecords.filter(c => c.employee_id === emp.id && c.clock_out);
    const totalHours = empClocks.reduce((s: number, c: any) => s + Number(c.hours_worked || 0), 0);
    const pay = totalHours * Number(emp.hourly_rate);
    const shifts = empClocks.length;
    return { ...emp, totalHours: Math.round(totalHours * 100) / 100, pay: Math.round(pay * 100) / 100, shifts };
  });

  const totalPayroll = payrollData.reduce((s, e) => s + e.pay, 0);

  const exportPayroll = () => {
    const csv = ['Name,Role,Shifts,Hours,Rate,Total Pay'].concat(
      payrollData.map(e => `${e.name},${e.role},${e.shifts},${e.totalHours},$${e.hourly_rate},$${e.pay}`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `payroll-${format(new Date(), 'yyyy-MM')}.csv`; a.click();
  };

  return (
    <Screen title="Employees" subtitle={`${employees.filter(e => e.is_active).length} active · ${clockedIn.size} clocked in`}>
      <div className="space-y-5">

        {/* Tabs */}
        <div className="flex gap-2">
          {[{ id: 'clock', label: '🕐 Time Clock' }, { id: 'staff', label: '👥 Staff' }, { id: 'payroll', label: '💰 Payroll' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors border',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TIME CLOCK ── */}
        {tab === 'clock' && (
          <div className="space-y-5">
            {/* PIN pad */}
            <div className="tile p-6">
              <p className="font-bold text-text text-center mb-1">Employee Clock In / Out</p>
              <p className="text-xs text-muted text-center mb-5">Enter your PIN to clock in or out</p>

              <div className="text-center mb-5">
                <div className="inline-flex items-center gap-3 bg-surface rounded-2xl px-6 py-4 border border-border">
                  {[0,1,2,3,4,5,6,7].map(i => (
                    <div key={i} className={cn('h-3 w-3 rounded-full transition-all', i < pinInput.length ? 'bg-accent' : 'bg-gray-200')} />
                  ))}
                </div>
              </div>

              {pinMsg && (
                <div className={cn('mb-4 rounded-xl px-4 py-3 text-sm font-semibold text-center', pinMsg.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-accent')}>
                  {pinMsg.text}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4 max-w-xs mx-auto">
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => (
                  <button key={String(k)} onClick={() => {
                    if (k === '⌫') setPinInput(p => p.slice(0,-1));
                    else if (k !== '') setPinInput(p => p.length < 8 ? p + k : p);
                  }}
                    className={cn('h-14 rounded-2xl text-xl font-bold transition-all active:scale-95', k === '' ? 'opacity-0 pointer-events-none' : 'bg-surface border border-border text-text hover:bg-border')}>
                    {k}
                  </button>
                ))}
              </div>

              <div className="max-w-xs mx-auto">
                <button onClick={handlePinAction} disabled={pinInput.length < 4 || processing}
                  className="btn btn-accent btn-full py-4 text-base">
                  {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
                  {processing ? 'Processing…' : 'Clock In / Out'}
                </button>
              </div>
            </div>

            {/* Who's clocked in */}
            {clockedIn.size > 0 && (
              <div className="tile p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Currently Clocked In</p>
                <div className="space-y-2">
                  {employees.filter(e => clockedIn.has(e.id)).map(emp => {
                    const rec = clockRecords.find(c => c.employee_id === emp.id && !c.clock_out);
                    const mins = rec ? Math.round((Date.now() - new Date(rec.clock_in).getTime()) / 60000) : 0;
                    const hrs = Math.floor(mins / 60); const mn = mins % 60;
                    return (
                      <div key={emp.id} className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-600 text-white font-black">{emp.name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-green-900 text-sm">{emp.name}</p>
                          <p className="text-xs text-green-700">{hrs}h {mn}m · clocked in {rec ? format(new Date(rec.clock_in), 'h:mm a') : ''}</p>
                        </div>
                        <div className="ml-auto h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today's clock records */}
            <div className="tile overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <p className="font-bold text-text text-sm">Today's Shifts</p>
              </div>
              <div className="divide-y divide-border/60">
                {clockRecords.filter(c => c.clock_in >= new Date().toISOString().split('T')[0]).length === 0
                  ? <p className="px-5 py-6 text-center text-muted text-sm">No clock records today</p>
                  : clockRecords.filter(c => c.clock_in >= new Date().toISOString().split('T')[0]).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-semibold text-text text-sm">{c.employee_name}</p>
                        <p className="text-xs text-muted">In: {format(new Date(c.clock_in), 'h:mm a')}{c.clock_out ? ` · Out: ${format(new Date(c.clock_out), 'h:mm a')}` : ' · Still working'}</p>
                      </div>
                      {c.hours_worked && <span className="num font-bold text-text">{c.hours_worked}h</span>}
                      {!c.clock_out && <span className="chip chip-green text-[10px]">Active</span>}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ── STAFF ── */}
        {tab === 'staff' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowForm(v => !v)} className={cn('btn text-sm h-10 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>
                {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add Staff'}
              </button>
            </div>

            {showForm && (
              <div className="tile p-5 animate-scale-in">
                <p className="font-bold text-text mb-4">New Employee</p>
                <form onSubmit={addEmployee} className="space-y-3">
                  <div><label className="lbl">Full name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" autoFocus /></div>
                  <div><label className="lbl">Email (optional)</label><input type="email" value={form.email} onChange={e => f('email', e.target.value)} className="inp" /></div>
                  <div>
                    <label className="lbl">PIN * (4–8 digits)</label>
                    <input type="password" required minLength={4} maxLength={8} value={form.pin} onChange={e => f('pin', e.target.value.replace(/\D/g, ''))} className="inp font-mono tracking-widest text-xl" placeholder="••••" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="lbl">Role</label><select value={form.role} onChange={e => f('role', e.target.value)} className="inp"><option value="cashier">Cashier</option><option value="manager">Manager</option><option value="owner">Owner</option></select></div>
                    <div><label className="lbl">Hourly Rate $</label><input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} className="inp" placeholder="15.00" /></div>
                  </div>
                  {formErr && <p className="text-sm text-accent">{formErr}</p>}
                  <button type="submit" disabled={saving} className="btn btn-accent btn-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Add Employee
                  </button>
                </form>
              </div>
            )}

            <div className="tile overflow-hidden divide-y divide-border">
              {loading && <p className="py-8 text-center text-muted">Loading…</p>}
              {!loading && employees.length === 0 && <div className="py-12 text-center"><Users className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted text-sm">No staff added yet</p></div>}
              {employees.map(emp => (
                <div key={emp.id} className={cn('px-5 py-4 flex items-center gap-3', !emp.is_active && 'opacity-50')}>
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-full font-black text-lg text-white shrink-0',
                    emp.role === 'owner' ? 'bg-accent' : emp.role === 'manager' ? 'bg-blue-600' : 'bg-gray-500')}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-text text-sm">{emp.name}</p>
                      <span className={cn('chip text-[10px]', emp.role === 'owner' ? 'chip-red' : emp.role === 'manager' ? 'chip-blue' : 'chip-gray')}>{emp.role}</span>
                      {clockedIn.has(emp.id) && <span className="chip chip-green text-[10px]">● Clocked in</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted">PIN: <span className="font-mono">{showPins.has(emp.id) ? emp.pin : '•'.repeat(emp.pin?.length ?? 4)}</span></p>
                      <button onClick={() => setShowPins(p => { const s = new Set(p); s.has(emp.id) ? s.delete(emp.id) : s.add(emp.id); return s; })} className="text-dim hover:text-sub">
                        {showPins.has(emp.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                      {emp.hourly_rate && <span className="text-xs text-muted">· ${emp.hourly_rate}/hr</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggleActive(emp)} className="text-xs font-semibold rounded-xl px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      {emp.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => delEmployee(emp.id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PAYROLL ── */}
        {tab === 'payroll' && (
          <div className="space-y-4">
            <div className="tile p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">This Month's Payroll</p>
                <p className="num text-3xl font-black text-text">{fmt.currency(totalPayroll)}</p>
              </div>
              <button onClick={exportPayroll} className="btn btn-ghost gap-2 text-sm">
                <Download className="h-4 w-4" />Export CSV
              </button>
            </div>

            {payrollData.length === 0 ? (
              <div className="tile p-10 text-center">
                <p className="text-muted text-sm">Set hourly rates for employees to see payroll calculations</p>
              </div>
            ) : (
              <div className="tile overflow-hidden divide-y divide-border">
                {payrollData.map(emp => (
                  <div key={emp.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-text">{emp.name}</p>
                        <p className="text-xs text-muted">{emp.shifts} shifts · {emp.totalHours} hours · ${emp.hourly_rate}/hr</p>
                      </div>
                      <p className="num font-black text-text text-lg">{fmt.currency(emp.pay)}</p>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${totalPayroll > 0 ? (emp.pay / totalPayroll * 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clock history this month */}
            <div className="tile overflow-hidden">
              <div className="border-b border-border px-5 py-3.5"><p className="font-bold text-text text-sm">This Month's Shifts</p></div>
              <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
                {clockRecords.filter(c => c.clock_out).map(c => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-text">{c.employee_name}</p>
                      <p className="text-xs text-muted">{format(new Date(c.clock_in), 'MMM d')} · {format(new Date(c.clock_in), 'h:mm a')} – {c.clock_out ? format(new Date(c.clock_out), 'h:mm a') : '—'}</p>
                    </div>
                    <span className="num font-bold text-text">{c.hours_worked}h</span>
                  </div>
                ))}
                {clockRecords.filter(c => c.clock_out).length === 0 && <p className="px-5 py-6 text-center text-muted text-sm">No completed shifts this month</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
