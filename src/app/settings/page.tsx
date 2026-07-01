'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  Check, Plus, Building2, Users, ChevronRight,
  Trash2, Eye, EyeOff, Loader2, X, Store as StoreIcon,
  CheckCircle, AlertCircle
} from 'lucide-react';

type Tab = 'stores' | 'store_info' | 'employees' | 'account' | 'connector';

// ─── Employee PIN manager ────────────────────────────────────────────────────
function EmployeesTab({ store }: { store: any }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', pin: '', role: 'cashier' });
  const [pinVisible, setPinVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    const { data } = await createClient().from('employees').select('*').eq('store_id', store.id).order('name');
    setEmployees(data ?? []);
    setLoading(false);
  }, [store.id]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    const dupe = employees.find(emp => emp.pin === form.pin && emp.is_active);
    if (dupe) { setError(`PIN already used by ${dupe.name}`); return; }
    setSaving(true);
    const { error: err } = await createClient().from('employees').insert({
      store_id: store.id, name: form.name, email: form.email || null,
      pin: form.pin, role: form.role,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ name: '', email: '', pin: '', role: 'cashier' });
    setShowForm(false);
    load();
  };

  const toggle = async (emp: any) => {
    await createClient().from('employees').update({ is_active: !emp.is_active }).eq('id', emp.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Remove this employee?')) return;
    await createClient().from('employees').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-text">Staff &amp; PINs</p>
          <p className="text-xs text-muted mt-0.5">{employees.filter(e => e.is_active).length} active · {store.name}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className={cn('btn text-sm h-10 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add staff'}
        </button>
      </div>

      {showForm && (
        <div className="tile p-5">
          <p className="font-semibold text-text mb-4">New employee</p>
          <form onSubmit={submit} className="space-y-3">
            <div><label className="lbl">Full name *</label><input required value={form.name} onChange={e => f('name', e.target.value)} className="inp" placeholder="Jane Smith" /></div>
            <div><label className="lbl">Email (optional)</label><input type="email" value={form.email} onChange={e => f('email', e.target.value)} className="inp" placeholder="jane@store.com" /></div>
            <div><label className="lbl">PIN * (4–8 digits)</label>
              <input type="password" required minLength={4} maxLength={8} value={form.pin} onChange={e => f('pin', e.target.value.replace(/\D/g, ''))}
                className="inp font-mono tracking-widest text-xl" placeholder="••••" />
              <p className="text-xs text-muted mt-1">Used to clock in at POS register</p>
            </div>
            <div><label className="lbl">Role</label>
              <select value={form.role} onChange={e => f('role', e.target.value)} className="inp">
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            {error && <p className="text-sm text-accent bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <button type="submit" disabled={saving} className="btn btn-accent btn-full py-3">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Adding…</> : <><Check className="h-4 w-4" />Add employee</>}
            </button>
          </form>
        </div>
      )}

      <div className="tile overflow-hidden">
        {loading && <div className="p-8 text-center"><Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}
        {!loading && employees.length === 0 && (
          <div className="p-10 text-center">
            <Users className="h-10 w-10 text-dim mx-auto mb-3" />
            <p className="text-muted text-sm">No staff added yet.</p>
          </div>
        )}
        <div className="divide-y divide-border">
          {employees.map(emp => (
            <div key={emp.id} className={cn('px-5 py-4', !emp.is_active && 'opacity-50')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white font-black text-lg">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text text-sm">{emp.name}</p>
                      <span className={cn('chip text-[10px]',
                        emp.role === 'owner' ? 'bg-red-100 text-red-700' :
                        emp.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                        {emp.role}
                      </span>
                      {!emp.is_active && <span className="chip bg-gray-100 text-gray-400 text-[10px]">inactive</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted">PIN: </p>
                      <span className="font-mono text-xs text-text">
                        {pinVisible[emp.id] ? emp.pin : '•'.repeat(emp.pin?.length ?? 4)}
                      </span>
                      <button onClick={() => setPinVisible(p => ({ ...p, [emp.id]: !p[emp.id] }))}
                        className="text-dim hover:text-sub">
                        {pinVisible[emp.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                    {emp.email && <p className="text-xs text-dim mt-0.5">{emp.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggle(emp)}
                    className={cn('text-xs font-semibold rounded-xl px-3 py-1.5 transition-colors',
                      emp.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200')}>
                    {emp.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => del(emp.id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Store Info form ─────────────────────────────────────────────────────────
function StoreInfoTab({ store, refetch }: { store: any; refetch: () => void }) {
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', phone: '', email: '', tax_rate: '8.25'
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (store) setForm({
      name: store.name, address: store.address ?? '', city: store.city ?? '',
      state: store.state ?? '', phone: store.phone ?? '', email: store.email ?? '',
      tax_rate: String(Number(store.tax_rate) * 100),
    });
  }, [store]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await createClient().from('stores').update({
      name: form.name, address: form.address || null, city: form.city || null,
      state: form.state || null, phone: form.phone || null, email: form.email || null,
      tax_rate: parseFloat(form.tax_rate) / 100,
    }).eq('id', store.id);
    await refetch();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="tile p-5">
        <p className="font-bold text-text mb-4">Store Information</p>
        {[
          { k: 'name', l: 'Store name *', req: true },
          { k: 'address', l: 'Street address' },
          { k: 'city', l: 'City' },
          { k: 'state', l: 'State' },
          { k: 'phone', l: 'Phone number' },
          { k: 'email', l: 'Store email', t: 'email' },
        ].map(field => (
          <div key={field.k} className="mb-3">
            <label className="lbl">{field.l}</label>
            <input required={field.req} type={field.t ?? 'text'}
              value={(form as any)[field.k]} onChange={e => f(field.k, e.target.value)} className="inp" />
          </div>
        ))}
        <div>
          <label className="lbl">Tax rate (%)</label>
          <input type="number" step="0.01" min="0" max="50" value={form.tax_rate}
            onChange={e => f('tax_rate', e.target.value)} className="inp" />
          <p className="mt-1 text-xs text-muted">Added to taxable items at POS · Current: {form.tax_rate}%</p>
        </div>
      </div>
      <button type="submit" disabled={saving} className="btn btn-accent btn-full py-4">
        {saved ? <><CheckCircle className="h-5 w-5" />Saved!</>
          : saving ? <><Loader2 className="h-5 w-5 animate-spin" />Saving…</>
          : <><Check className="h-5 w-5" />Save Store Info</>}
      </button>
    </form>
  );
}

// ─── Multi-store manager ─────────────────────────────────────────────────────
function StoresTab({ stores, currentStore, switchStore, createStore }: {
  stores: any[]; currentStore: any;
  switchStore: (id: string) => void;
  createStore: (name: string) => Promise<any>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { setError('Store name is required'); return; }
    setCreating(true); setError('');
    try {
      const fullName = newCity ? `${newName} — ${newCity}` : newName;
      const result = await createStore(fullName);
      setCreating(false);
      if (result) {
        setNewName(''); setNewCity(''); setShowForm(false);
      } else {
        setError('Failed to create store — please try again');
      }
    } catch (err: any) {
      setCreating(false);
      setError(err.message || 'Something went wrong');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-text">Your Stores</p>
          <p className="text-xs text-muted mt-0.5">{stores.length} location{stores.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className={cn('btn text-sm h-10 px-4', showForm ? 'btn-ghost' : 'btn-accent')}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add store'}
        </button>
      </div>

      {showForm && (
        <div className="tile p-5">
          <p className="font-semibold text-text mb-1">New Store Location</p>
          <p className="text-xs text-muted mb-4">Each store gets its own inventory, sales, reports, and employees.</p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="lbl">Store name *</label>
              <input required value={newName} onChange={e => setNewName(e.target.value)}
                className="inp" placeholder="Quick Stop #2" autoFocus />
            </div>
            <div>
              <label className="lbl">City (optional)</label>
              <input value={newCity} onChange={e => setNewCity(e.target.value)}
                className="inp" placeholder="Houston" />
            </div>
            {error && <p className="text-sm text-accent">{error}</p>}
            <button type="submit" disabled={creating} className="btn btn-accent btn-full py-3">
              {creating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                : <><Building2 className="h-4 w-4" />Create Store</>}
            </button>
          </form>
        </div>
      )}

      {/* Store list */}
      <div className="tile overflow-hidden divide-y divide-border">
        {stores.map(s => {
          const isActive = s.id === currentStore?.id;
          return (
            <button key={s.id} onClick={() => switchStore(s.id)}
              className={cn('w-full flex items-center gap-4 px-5 py-4 text-left transition-colors',
                isActive ? 'bg-red-50' : 'hover:bg-surface')}>
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                isActive ? 'bg-accent' : 'bg-gray-100')}>
                <StoreIcon className={cn('h-6 w-6', isActive ? 'text-white' : 'text-gray-500')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-bold text-sm', isActive ? 'text-accent' : 'text-text')}>{s.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {s.city ? `${s.city}${s.state ? `, ${s.state}` : ''}` : s.address ?? 'No address set'}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {isActive && (
                  <span className="chip bg-red-100 text-accent text-[10px] font-bold">Active</span>
                )}
                <ChevronRight className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-dim')} />
              </div>
            </button>
          );
        })}
      </div>

      {stores.length > 1 && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-semibold text-blue-800 mb-1">💡 Switching stores</p>
          <p className="text-xs text-blue-700">
            Tap any store above to switch to it. All pages — inventory, sales, reports, employees — will show data for the selected store.
          </p>
        </div>
      )}
    </div>
  );
}


// ─── Connector tab ─────────────────────────────────────────────────────────────
function ConnectorTab({ store }: { store: any }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/connector/register', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed — check Supabase SQL has been run'); setLoading(false); return; }
      setResult(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* What is this */}
      <div className="tile p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <span className="text-accent text-lg font-black">R</span>
          </div>
          <div>
            <p className="font-bold text-text">RA Dragon Connector</p>
            <p className="text-xs text-muted">Windows app that auto-syncs your POS to RA Dragon</p>
          </div>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>✓ Installs on your back-office PC (where Gilbarco Passport runs)</p>
          <p>✓ Automatically reads sales, inventory, and reports directly from POS</p>
          <p>✓ Syncs to your RA Dragon account every 30 seconds</p>
          <p>✓ Works offline — queues data until internet returns</p>
        </div>
      </div>

      {/* Step 1: Get connector */}
      <div className="tile p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Step 1 — Get the Connector App</p>
        <p className="text-sm text-gray-600 mb-4">Download the Windows connector and install it on your store's back-office computer (the PC where Gilbarco Passport is installed).</p>
        <div className="rounded-xl bg-gray-50 border border-border p-4 text-sm font-mono text-gray-700 mb-3">
          Coming soon — download link will appear here
        </div>
        <p className="text-xs text-muted">The connector runs silently in the background as a Windows Service.</p>
      </div>

      {/* Step 2: Generate key */}
      <div className="tile p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Step 2 — Generate Your API Key</p>
        <p className="text-sm text-gray-600 mb-4">Generate a secret key that connects your store to the RA Dragon connector. Enter this key in the connector's Settings screen.</p>

        {!result && (
          <button onClick={generate} disabled={loading}
            className="btn btn-accent btn-full gap-2">
            {loading ? 'Generating…' : '🔑 Generate Connector Key'}
          </button>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mt-3">
            <p className="text-sm text-red-700 font-medium">Error: {error}</p>
            <p className="text-xs text-red-600 mt-1">Make sure you ran the Supabase SQL: <code>alter table stores add column if not exists connector_api_key text;</code></p>
          </div>
        )}

        {result?.success && (
          <div className="space-y-3">
            <div className="rounded-xl bg-green-50 border border-green-200 p-3 mb-3">
              <p className="text-xs font-bold text-green-800 mb-1">✓ Key generated — copy these into the connector's Settings</p>
            </div>

            {[
              { label: 'Cloud URL', value: result.cloud_url },
              { label: 'Store ID', value: result.store_id },
              { label: 'API Key', value: result.api_key },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted font-semibold mb-1">{label}</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl bg-gray-50 border border-border px-3 py-2 text-xs font-mono text-gray-700 truncate">{value}</div>
                  <button onClick={() => copy(value, label)}
                    className={cn('flex h-9 w-16 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors',
                      copied === label ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
                    {copied === label ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}

            <button onClick={generate} disabled={loading} className="btn btn-ghost btn-full text-sm mt-2">
              Regenerate key (invalidates old key)
            </button>
          </div>
        )}
      </div>

      {/* Step 3: Setup */}
      <div className="tile p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Step 3 — Enter in Connector Settings</p>
        <div className="space-y-2 text-sm text-gray-600">
          <p>1. Open RA Dragon Connector on your store PC</p>
          <p>2. Right-click the tray icon → Settings</p>
          <p>3. Paste the Cloud URL, Store ID, and API Key</p>
          <p>4. Click Save — the connector will auto-detect your POS and start syncing</p>
        </div>
      </div>
    </div>
  );
}

// ─── Account tab ─────────────────────────────────────────────────────────────
function AccountTab() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.replace('/');
  };

  return (
    <div className="space-y-4">
      <div className="tile p-5">
        <p className="font-bold text-text mb-4">Account</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Email</p>
            <p className="text-sm font-semibold text-text">{loading ? '…' : email}</p>
          </div>
          <div>
            <p className="text-xs text-muted font-medium uppercase tracking-wide mb-1">Plan</p>
            <span className="chip bg-green-100 text-green-700 text-xs font-bold">Starter — Free</span>
          </div>
        </div>
      </div>
      <button onClick={logout} className="btn btn-ghost btn-full py-4 text-accent border-accent/30 hover:bg-red-50">
        Sign Out
      </button>
    </div>
  );
}

// ─── Main settings page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { store, stores, switchStore, createStore, refetch } = useStore();
  const [tab, setTab] = useState<Tab>('stores');

  const TABS = [
    { id: 'stores',     label: '🏪 Stores',     show: true },
    { id: 'store_info', label: '✏️ Store Info',  show: !!store },
    { id: 'employees',  label: '👥 Employees',   show: !!store },
    { id: 'account',    label: '👤 Account',     show: true },
    { id: 'connector', label: '🔌 Connector', show: !!store },
  ];

  if (!mounted) return null;

  return (
    <Screen title="Settings" subtitle={store?.name}>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.filter(t => t.show).map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={cn('flex-none rounded-full px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap',
              tab === t.id ? 'bg-accent text-white' : 'bg-surface text-sub border border-border hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stores'     && <StoresTab stores={stores} currentStore={store} switchStore={switchStore} createStore={createStore} />}
      {tab === 'store_info' && store && <StoreInfoTab store={store} refetch={refetch} />}
      {tab === 'employees'  && store && <EmployeesTab store={store} />}
      {tab === 'account'    && <AccountTab />}
      {tab === 'connector'  && store && <ConnectorTab store={store} />}
    </Screen>
  );
}
