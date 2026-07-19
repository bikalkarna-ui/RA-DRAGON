'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Users, Plus, X, Check, Pencil, Trash2, Clock, Download, ChevronDown, ChevronUp, Phone, DollarSign, Calendar, Hash } from 'lucide-react';

type Tab = 'clock' | 'roster' | 'payroll';

const EMPTY_EMP = { name: '', role: 'Cashier', pin: '', hourly_rate: '', phone: '' };
const ROLES = ['Owner','Manager','Assistant Manager','Cashier','Stock Clerk','Accountant'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function duration(start: string, end?: string) {
  const ms = new Date(end || Date.now()).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${pad(m)}m`;
}
function fmtTime(d: string) { try { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); } catch { return '—'; } }
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return '—'; } }

export default function EmployeesPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [tab, setTab] = useState<Tab>('clock');
  const [employees, setEmployees] = useState<any[]>([]);
  const [clocks, setClocks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_EMP);
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [empHistory, setEmpHistory] = useState<Record<string, any[]>>({});
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setMounted(true); }, []);

  const loadAll = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const [{ data: emps }, { data: active }, { data: hist }] = await Promise.all([
      sb.from('employees').select('*').eq('store_id', store.id).eq('is_active', true).order('name'),
      sb.from('time_clock').select('*').eq('store_id', store.id).is('clock_out', null).order('clock_in'),
      sb.from('time_clock').select('*').eq('store_id', store.id).not('clock_out', 'is', null).gte('clock_in', weekAgo).order('clock_in', { ascending: false }).limit(50),
    ]);
    setEmployees(emps ?? []);
    setClocks(active ?? []);
    setHistory(hist ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) loadAll(); }, [mounted, store, loadAll]);

  const loadEmpHistory = async (empId: string) => {
    if (expandedEmp === empId) { setExpandedEmp(null); return; }
    const { data } = await createClient().from('time_clock').select('*').eq('employee_id', empId).order('clock_in', { ascending: false }).limit(20);
    setEmpHistory(p => ({ ...p, [empId]: data ?? [] }));
    setExpandedEmp(empId);
  };

  const submitPIN = async () => {
    if (!store || pin.length < 4) return;
    const sb = createClient();
    if (employees.length === 0) { setPinMsg({ text: 'No employees found — add employees in Roster tab first', ok: false }); setPin(''); setTimeout(() => setPinMsg(null), 3000); return; }
    const emp = employees.find(e => String(e.pin).trim() === String(pin).trim());
    if (!emp) { setPinMsg({ text: `Wrong PIN (${employees.length} employee${employees.length!==1?'s':''} on file) — check Roster tab`, ok: false }); setPin(''); setTimeout(() => setPinMsg(null), 3000); return; }
    const active = clocks.find(c => c.employee_id === emp.id);
    if (active) {
      const ms = Date.now() - new Date(active.clock_in).getTime();
      const hrs = ms / 3600000;
      await sb.from('time_clock').update({ clock_out: new Date().toISOString(), hours_worked: parseFloat(hrs.toFixed(2)) }).eq('id', active.id);
      setPinMsg({ text: `✓ ${emp.name} clocked OUT — ${duration(active.clock_in)}`, ok: true });
      // Log to timeline
      fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clock_out', title: `${emp.name} clocked out`, description: duration(active.clock_in), employee_name: emp.name, store_id: store?.id }) }).catch(() => {});
    } else {
      const { error: clockErr } = await sb.from('time_clock').insert({ store_id: store.id, employee_id: emp.id, employee_name: emp.name, clock_in: new Date().toISOString() });
      if (clockErr) { setPinMsg({ text: `Error: ${clockErr.message}`, ok: false }); setPin(''); setTimeout(() => setPinMsg(null), 5000); setSaving(false); return; }
      setPinMsg({ text: `✓ ${emp.name} clocked IN`, ok: true });
      fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clock_in', title: `${emp.name} clocked in`, employee_name: emp.name, store_id: store?.id }) }).catch(() => {});
    }
    setPin(''); loadAll(); setTimeout(() => setPinMsg(null), 3000);
  };

  const [formErr, setFormErr] = useState('');

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault(); if (!store) return;
    setFormErr('');
    const payload = { store_id: store.id, name: form.name.trim(), role: form.role, pin: form.pin.trim(), hourly_rate: parseFloat(form.hourly_rate) || null, phone: form.phone.trim() || null };
    const sb = createClient();
    const { error } = editId
      ? await sb.from('employees').update(payload).eq('id', editId)
      : await sb.from('employees').insert({ ...payload, is_active: true });
    if (error) {
      console.error('submitForm failed:', error);
      setFormErr(error.message || 'Could not save employee — please try again');
      return;
    }
    setShowForm(false); setEditId(null); setForm(EMPTY_EMP); loadAll();
  };

  const delEmp = async (id: string) => {
    if (!confirm('Remove this employee?')) return;
    await createClient().from('employees').update({ is_active: false }).eq('id', id); loadAll();
  };

  const exportPayroll = () => {
    const rows = [['Employee', 'Role', 'Date', 'Clock In', 'Clock Out', 'Hours', 'Rate', 'Pay']];
    history.forEach(c => {
      const emp = employees.find(e => e.id === c.employee_id);
      rows.push([c.employee_name, emp?.role ?? '', fmtDate(c.clock_in), fmtTime(c.clock_in), c.clock_out ? fmtTime(c.clock_out) : 'Still in', c.hours_worked?.toFixed(2) ?? '0', emp?.hourly_rate ? fmt.currency(emp.hourly_rate) : '—', emp?.hourly_rate && c.hours_worked ? fmt.currency(emp.hourly_rate * c.hours_worked) : '—']);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const mo = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' }).replace('/', '-');
    a.href = url; a.download = `payroll-${mo}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  // Payroll calculations
  const payroll = employees.map(emp => {
    const shifts = history.filter(c => c.employee_id === emp.id);
    const totalHrs = shifts.reduce((s, c) => s + (c.hours_worked || 0), 0);
    const regHrs = Math.min(totalHrs, 40);
    const otHrs = Math.max(0, totalHrs - 40);
    const rate = emp.hourly_rate || 0;
    const pay = rate * regHrs + rate * 1.5 * otHrs;
    return { emp, shifts: shifts.length, totalHrs, regHrs, otHrs, rate, pay };
  });

  if (!mounted) return null;

  const TABS = [
    { id: 'clock' as Tab,   label: '⏱ Time Clock' },
    { id: 'roster' as Tab,  label: '👥 Roster'     },
    { id: 'payroll' as Tab, label: '💰 Payroll'     },
  ];

  return (
    <Screen title="Employees" subtitle={`${employees.length} staff · ${clocks.length > 0 ? clocks.length + ' clocked in' : 'none clocked in'}`}
      action={tab === 'roster'
        ? <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(EMPTY_EMP); }} className={cn('btn text-sm h-9 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? 'Cancel' : 'Add'}</button>
        : tab === 'payroll' ? <button onClick={exportPayroll} className="btn btn-ghost text-sm h-9 px-4"><Download className="h-4 w-4" />Export</button> : null}>

      <div className="space-y-5">
        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors',
                tab === t.id ? 'bg-accent text-white border-accent' : 'bg-surface text-sub border-border hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TIME CLOCK ── */}
        {tab === 'clock' && (
          <>
            {/* PIN Pad */}
            <div className="tile p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Enter PIN to Clock In / Out</p>
              <div className="flex items-center justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={cn('h-4 w-4 rounded-full border-2 transition-all', i < pin.length ? 'bg-accent border-accent scale-110' : 'border-gray-300')} />
                ))}
              </div>
              {pinMsg && (
                <div className={cn('rounded-xl px-4 py-3 mb-4 text-sm font-bold', pinMsg.ok ? 'bg-green-50 border border-green-300 text-green-800' : 'bg-red-50 border border-red-300 text-red-800')}>
                  {pinMsg.text}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                {[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(d => (
                  <button key={String(d)} disabled={!d && d !== 0}
                    onClick={() => {
                      if (d === '⌫') setPin(p => p.slice(0,-1));
                      else if (pin.length < 4) { const np = pin + String(d); setPin(np); if (np.length === 4) setTimeout(() => { submitPIN(); }, 300); }
                    }}
                    className={cn('flex h-16 items-center justify-center rounded-2xl font-black text-xl transition-all active:scale-95',
                      d === '⌫' ? 'text-muted bg-surface border border-border hover:bg-gray-100' :
                      !d && d !== 0 ? 'invisible' : 'bg-surface border border-border hover:bg-gray-100 text-text')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Currently clocked in */}
            {clocks.length > 0 && (
              <div className="tile overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-green-50">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-wide">Currently Working ({clocks.length})</p>
                </div>
                {clocks.map(c => (
                  <div key={c.id} className="px-5 py-4 flex items-center justify-between border-b border-border/50 last:border-0">
                    <div>
                      <p className="font-bold text-text">{c.employee_name}</p>
                      <p className="text-xs text-muted">Clocked in {fmtTime(c.clock_in)}</p>
                    </div>
                    <div className="text-right">
                      <p className="num font-bold text-green-700">{duration(c.clock_in)}</p>
                      <div className="flex h-2 w-2 rounded-full bg-green-500 ml-auto mt-1 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent history */}
            {history.length > 0 && (
              <div className="tile overflow-hidden">
                <div className="px-5 py-3 border-b border-border"><p className="text-xs font-bold text-muted uppercase tracking-wide">Recent Shifts</p></div>
                {history.slice(0, 20).map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-text">{c.employee_name}</p>
                      <p className="text-xs text-muted">{fmtDate(c.clock_in)} · {fmtTime(c.clock_in)} – {c.clock_out ? fmtTime(c.clock_out) : '–'}</p>
                    </div>
                    <p className="num font-bold text-text text-sm">{c.hours_worked ? `${c.hours_worked.toFixed(1)}h` : '–'}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ROSTER ── */}
        {tab === 'roster' && (
          <>
            {showForm && (
              <div className="tile p-5">
                <p className="font-bold text-text mb-4">{editId ? 'Edit Employee' : 'New Employee'}</p>
                <form onSubmit={submitForm} className="space-y-3">
                  <div><label className="lbl">Full name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" autoFocus /></div>
                  <div><label className="lbl">Role</label><select value={form.role} onChange={e => f('role', e.target.value)} className="inp">{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
                  <div><label className="lbl">PIN (4 digits) *</label><input type="text" inputMode="numeric" pattern="[0-9]*" required maxLength={4} value={form.pin} onChange={e => f('pin', e.target.value.replace(/\D/g,'').slice(0,4))} className="inp num" placeholder="4-digit clock-in PIN" /></div>
                  <div><label className="lbl">Phone</label><input type="tel" value={form.phone} onChange={e => f('phone', e.target.value)} className="inp" /></div>
                  <div><label className="lbl">Hourly rate $</label><input type="number" step="0.01" min="0" value={form.hourly_rate} onChange={e => f('hourly_rate', e.target.value)} className="inp" placeholder="15.00" /></div>
                  <button type="submit" className="btn btn-accent btn-full"><Check className="h-4 w-4" />{editId ? 'Save changes' : 'Add employee'}</button>
                  {formErr && (
                    <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      {formErr}
                    </p>
                  )}
                </form>
              </div>
            )}

            {loading && <div className="tile p-8 text-center text-muted">Loading…</div>}

            {!loading && employees.length === 0 && (
              <div className="tile p-10 text-center"><Users className="h-10 w-10 text-dim mx-auto mb-3" /><p className="text-muted">No employees yet</p></div>
            )}

            <div className="space-y-3">
              {employees.map(emp => {
                const isActive = clocks.some(c => c.employee_id === emp.id);
                const shifts = history.filter(c => c.employee_id === emp.id);
                const weekHrs = shifts.reduce((s, c) => s + (c.hours_worked || 0), 0);
                const expanded = expandedEmp === emp.id;
                return (
                  <div key={emp.id} className="tile overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl font-black text-xl text-white shrink-0', isActive ? 'bg-green-600' : 'bg-gray-400')}>
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-text">{emp.name}</p>
                              {isActive && <span className="chip chip-green text-[10px]">● Working</span>}
                            </div>
                            <p className="text-xs text-muted mt-0.5">{emp.role}</p>
                            {emp.phone && <p className="text-xs text-muted flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{emp.phone}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => loadEmpHistory(emp.id)} className={cn('flex h-8 w-8 items-center justify-center rounded-xl', expanded ? 'bg-accent text-white' : 'text-muted hover:text-text hover:bg-surface')}>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button onClick={() => { setEditId(emp.id); setShowForm(true); setForm({ name: emp.name, role: emp.role, pin: emp.pin ?? '', hourly_rate: emp.hourly_rate ? String(emp.hourly_rate) : '', phone: emp.phone ?? '' }); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:text-text hover:bg-surface"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => delEmp(emp.id)} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:text-accent hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">This Week</p><p className="num font-bold text-text">{weekHrs.toFixed(1)}h</p></div>
                        <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">Rate</p><p className="num font-bold text-text">{emp.hourly_rate ? fmt.currency(emp.hourly_rate)+'/h' : '—'}</p></div>
                        <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">PIN</p><p className="num font-bold text-text">{'•'.repeat(emp.pin?.length ?? 4)}</p></div>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t border-border bg-surface/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Shift History</p>
                        {(empHistory[emp.id] ?? []).length === 0 ? <p className="text-xs text-muted">No shifts recorded</p> : (
                          <div className="space-y-2">
                            {(empHistory[emp.id] ?? []).map(c => (
                              <div key={c.id} className="flex justify-between text-xs">
                                <span className="text-muted">{fmtDate(c.clock_in)}</span>
                                <span className="text-gray-600">{fmtTime(c.clock_in)} – {c.clock_out ? fmtTime(c.clock_out) : 'In progress'}</span>
                                <span className="num font-bold text-text">{c.hours_worked ? `${c.hours_worked.toFixed(1)}h` : '–'}</span>
                                {emp.hourly_rate && c.hours_worked && <span className="num text-green-700 font-bold">{fmt.currency(emp.hourly_rate * c.hours_worked)}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PAYROLL ── */}
        {tab === 'payroll' && (
          <>
            <div className="tile p-4 border-l-4 border-l-accent">
              <p className="text-xs text-muted font-medium mb-1">14-Day Payroll Estimate</p>
              <p className="num font-black text-3xl text-text">{fmt.currency(payroll.reduce((s, p) => s + p.pay, 0))}</p>
              <p className="text-xs text-muted mt-1">{payroll.reduce((s, p) => s + p.totalHrs, 0).toFixed(1)} total hours · {employees.length} employees</p>
            </div>
            <div className="space-y-3">
              {payroll.filter(p => p.shifts > 0).map(({ emp, shifts, totalHrs, regHrs, otHrs, rate, pay }) => (
                <div key={emp.id} className="tile p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-text">{emp.name}</p>
                      <p className="text-xs text-muted">{emp.role} · {shifts} shifts</p>
                    </div>
                    <p className="num font-black text-2xl text-text">{fmt.currency(pay)}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">Total Hrs</p><p className="num font-bold text-text">{totalHrs.toFixed(1)}</p></div>
                    <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">Regular</p><p className="num font-bold text-text">{regHrs.toFixed(1)}</p></div>
                    <div className={cn('rounded-xl p-2.5 text-center', otHrs > 0 ? 'bg-amber-50' : 'bg-surface')}><p className="text-[10px] text-muted">Overtime</p><p className={cn('num font-bold', otHrs > 0 ? 'text-amber-700' : 'text-text')}>{otHrs.toFixed(1)}</p></div>
                    <div className="rounded-xl bg-surface p-2.5 text-center"><p className="text-[10px] text-muted">Rate</p><p className="num font-bold text-text">{rate ? fmt.currency(rate) : '—'}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={exportPayroll} className="btn btn-ghost btn-full gap-2"><Download className="h-4 w-4" />Export Payroll CSV</button>
          </>
        )}
      </div>
    </Screen>
  );
}
