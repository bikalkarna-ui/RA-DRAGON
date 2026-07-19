'use client';
import { useState } from 'react';
import { useRole } from '@/hooks/use-role';
import { Shield, X, Users, Briefcase, Loader2 } from 'lucide-react';

const LABELS: Record<string, string> = { owner: 'Owner', manager: 'Manager', employee: 'Employee' };
const ICONS: Record<string, any> = { owner: Shield, manager: Briefcase, employee: Users };

export function RoleSwitcher({ storeId }: { storeId?: string }) {
  const { role, switchWithPin, returnToOwner } = useRole();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<'manager' | 'employee' | 'owner' | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const Icon = ICONS[role];

  const openSwitcher = () => {
    setErr(''); setPin(''); setTarget(null);
    if (role === 'employee') {
      setErr('Role not assigned');
    }
    setOpen(true);
  };

  const attempt = async () => {
    if (!target || !storeId) return;
    setBusy(true); setErr('');
    const errMsg = target === 'owner'
      ? await returnToOwner(pin, storeId)
      : await switchWithPin(target, pin, storeId);
    setBusy(false);
    if (errMsg) { setErr(errMsg); return; }
    setOpen(false); setPin(''); setTarget(null);
    window.location.reload();
  };

  return (
    <>
      <button onClick={openSwitcher}
        className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-sub hover:bg-surface transition-colors">
        <Icon className="h-3.5 w-3.5" />
        {LABELS[role]}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="font-black text-lg text-text">Switch View</p>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-muted" /></button>
            </div>

            {role === 'employee' ? (
              <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                Role not assigned
              </p>
            ) : !target ? (
              <div className="space-y-2">
                <p className="text-xs text-muted mb-3">Currently viewing as <b>{LABELS[role]}</b>.</p>
                {role !== 'owner' && (
                  <button onClick={() => { setTarget('owner'); setErr(''); }}
                    className="w-full flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-surface text-left">
                    <Shield className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold text-text">Return to Owner view</span>
                  </button>
                )}
                {role === 'owner' && (
                  <button onClick={() => { setTarget('manager'); setErr(''); }}
                    className="w-full flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-surface text-left">
                    <Briefcase className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold text-text">Switch to Manager view</span>
                  </button>
                )}
                <button onClick={() => { setTarget('employee'); setErr(''); }}
                  className="w-full flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-surface text-left">
                  <Users className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-text">Switch to Employee view</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  {target === 'owner' ? "Enter the owner PIN to return to full access." : `Enter a valid ${target} PIN.`}
                </p>
                <input
                  type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                  value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={e => e.key === 'Enter' && attempt()}
                  placeholder="4-digit PIN" autoFocus
                  className="inp num text-center text-2xl font-black tracking-widest"
                />
                {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setTarget(null)} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-sub">Back</button>
                  <button onClick={attempt} disabled={busy || pin.length !== 4}
                    className="flex-1 rounded-xl bg-accent text-white py-3 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
