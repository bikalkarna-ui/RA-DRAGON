'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Plus, X, Trash2, Users, Eye, EyeOff } from 'lucide-react';

interface Employee { id:string; name:string; email:string|null; pin:string; role:string; is_active:boolean; created_at:string; }

const ROLES = [
  { id:'cashier', label:'Cashier', cls:'bg-obsidian-700 text-obsidian-300', perms:['Process sales','View inventory','Print receipts'] },
  { id:'manager', label:'Manager', cls:'bg-fire-900/40 text-fire-400', perms:['All cashier permissions','Add/edit products','View reports','Manage staff'] },
];

export default function EmployeesPage() {
  const { store } = useStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', pin:'', role:'cashier' });
  const [error, setError] = useState<string|null>(null);
  const [showPins, setShowPins] = useState<Set<string>>(new Set());

  const fetchEmployees = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('employees').select('*').eq('store_id', store.id).order('name');
    setEmployees((data as Employee[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const f = (k:string, v:string) => setForm(p=>({...p,[k]:v}));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (form.pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (employees.find(emp => emp.pin===form.pin && emp.is_active)) { setError('PIN already in use — choose another'); return; }
    await createClient().from('employees').insert({ store_id:store?.id, name:form.name, email:form.email||null, pin:form.pin, role:form.role });
    setForm({ name:'', email:'', pin:'', role:'cashier' }); setShowForm(false); fetchEmployees();
  };

  const toggle = async (emp: Employee) => {
    await createClient().from('employees').update({ is_active:!emp.is_active }).eq('id', emp.id);
    fetchEmployees();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    await createClient().from('employees').delete().eq('id', id);
    fetchEmployees();
  };

  const togglePin = (id:string) => setShowPins(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });

  return (
    <AppShell title="Employees" storeName={store?.name}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROLES.map(r => (
            <div key={r.id} className="d-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className={cn('d-badge', r.cls)}>{r.label}</span>
                <span className="text-2xl font-bold text-white">{employees.filter(e=>e.role===r.id&&e.is_active).length}</span>
              </div>
              <ul className="space-y-1.5">
                {r.perms.map(p => <li key={p} className="text-xs text-obsidian-400 flex items-center gap-1.5"><span className="text-fire-700">▸</span>{p}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={() => setShowForm(v=>!v)} className={showForm ? 'btn-ghost' : 'btn-fire'}>
            {showForm ? <X className="h-4 w-4"/> : <Plus className="h-4 w-4"/>}
            {showForm ? 'Cancel' : 'Add employee'}
          </button>
        </div>

        {showForm && (
          <div className="d-card p-5">
            <h3 className="font-bold text-white mb-4">New employee</h3>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div><label className="d-label">Full name *</label><input required value={form.name} onChange={e=>f('name',e.target.value)} className="d-input" /></div>
              <div><label className="d-label">Email</label><input type="email" value={form.email} onChange={e=>f('email',e.target.value)} className="d-input" placeholder="Optional" /></div>
              <div><label className="d-label">PIN * (4–8 digits)</label><input type="password" required minLength={4} maxLength={8} value={form.pin} onChange={e=>f('pin',e.target.value)} className="d-input mono tracking-widest" placeholder="••••" /></div>
              <div><label className="d-label">Role</label>
                <select value={form.role} onChange={e=>f('role',e.target.value)} className="d-select">
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              {error && <p className="sm:col-span-4 text-sm text-fire-400">{error}</p>}
              <div><button type="submit" className="btn-fire h-10">Add employee</button></div>
            </form>
          </div>
        )}

        <div className="d-card overflow-hidden">
          <div className="border-b border-dragon-border px-5 py-3.5">
            <h3 className="font-semibold text-white">All Staff ({employees.filter(e=>e.is_active).length} active)</h3>
          </div>
          <div className="divide-y divide-dragon-border">
            {loading && <p className="px-5 py-8 text-center text-obsidian-500">Loading…</p>}
            {!loading && employees.length===0 && (
              <div className="flex flex-col items-center py-12">
                <Users className="h-10 w-10 text-obsidian-800 mb-3" />
                <p className="text-sm text-obsidian-500">No employees yet. Add your first cashier above.</p>
              </div>
            )}
            {employees.map(emp => {
              const roleInfo = ROLES.find(r=>r.id===emp.role);
              const pinVisible = showPins.has(emp.id);
              return (
                <div key={emp.id} className={cn('flex items-center justify-between px-5 py-4 hover:bg-obsidian-900/20 transition-colors', !emp.is_active&&'opacity-50')}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fire-900/30 border border-fire-800/30 text-sm font-bold text-fire-400">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{emp.name}</p>
                        {roleInfo && <span className={cn('d-badge text-[10px]', roleInfo.cls)}>{roleInfo.label}</span>}
                        {!emp.is_active && <span className="d-badge bg-obsidian-800 text-obsidian-500 text-[10px]">Inactive</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {emp.email && <p className="text-xs text-obsidian-500">{emp.email}</p>}
                        <div className="flex items-center gap-1 text-xs text-obsidian-600">
                          <span>PIN:</span>
                          <span className="mono">{pinVisible ? emp.pin : '•'.repeat(emp.pin.length)}</span>
                          <button onClick={()=>togglePin(emp.id)} className="text-obsidian-700 hover:text-obsidian-400">
                            {pinVisible ? <EyeOff className="h-3 w-3"/> : <Eye className="h-3 w-3"/>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>toggle(emp)}
                      className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition-all border', emp.is_active?'border-dragon-border text-obsidian-500 hover:border-fire-800 hover:text-fire-400':'border-fire-800/50 text-fire-500 hover:bg-fire-950/30')}>
                      {emp.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={()=>del(emp.id)} className="p-1.5 rounded text-obsidian-700 hover:text-fire-500 hover:bg-fire-950/30 transition-colors">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
