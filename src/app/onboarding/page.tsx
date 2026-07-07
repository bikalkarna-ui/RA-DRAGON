'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Store, Users, BarChart3, Check, ChevronRight, Loader2 } from 'lucide-react';

const STEPS = [
  { id: 1, icon: Store,    title: 'Create Your Store',      desc: 'Set up your store name and location' },
  { id: 2, icon: Users,    title: 'Add Your First Employee', desc: 'Add a cashier with a PIN for time clock' },
  { id: 3, icon: BarChart3,title: 'Upload Your First Report', desc: 'Scan your daily close report — AI reads it instantly' },
];

export default function OnboardingPage() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Step 1 state
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeType, setStoreType] = useState('Gas Station / Convenience Store');

  // Step 2 state
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState('Cashier');
  const [empPin, setEmpPin] = useState('');
  const [empRate, setEmpRate] = useState('');
  const [skipEmp, setSkipEmp] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const createStore = async () => {
    if (!storeName.trim()) { setError('Store name is required'); return; }
    setLoading(true); setError('');
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: existing } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
      if (existing) { setStep(2); setLoading(false); return; }

      const { error: err } = await sb.from('stores').insert({
        owner_id: user.id,
        name: storeName.trim(),
        address: storeAddress.trim() || null,
        phone: storePhone.trim() || null,
        store_type: storeType,
      });
      if (err) throw err;
      setStep(2);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const addEmployee = async () => {
    if (!skipEmp && (!empName.trim() || !empPin.trim())) { setError('Name and PIN are required'); return; }
    if (!skipEmp && empPin.length !== 4) { setError('PIN must be exactly 4 digits'); return; }
    setLoading(true); setError('');
    try {
      if (!skipEmp) {
        const sb = createClient();
        const { data: store } = await sb.from('stores').select('id').order('created_at').limit(1).maybeSingle();
        if (store) {
          await sb.from('employees').insert({
            store_id: store.id, name: empName.trim(), role: empRole,
            pin: empPin, hourly_rate: empRate ? parseFloat(empRate) : null, is_active: true,
          });
        }
      }
      setStep(3);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const finish = () => {
    router.push('/home');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <span className="text-white font-black text-lg">R</span>
        </div>
        <span className="font-black text-xl text-text">RYXSOR AI</span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8 w-full max-w-md">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm transition-all',
              step > s.id  ? 'bg-green-500 text-white' :
              step === s.id ? 'bg-accent text-white' :
              'bg-gray-200 text-gray-400')}>
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2', step > s.id ? 'bg-green-500' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
        {/* Step 1 */}
        {step === 1 && (
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 mb-4">
              <Store className="h-7 w-7 text-accent" />
            </div>
            <h1 className="text-2xl font-black text-text mb-1">Create Your Store</h1>
            <p className="text-gray-500 text-sm mb-6">This is how your store appears in RYXSOR AI</p>
            <div className="space-y-4">
              <div>
                <label className="lbl">Store name *</label>
                <input value={storeName} onChange={e => setStoreName(e.target.value)}
                  placeholder="24 Seven Mart #18" className="inp" autoFocus />
              </div>
              <div>
                <label className="lbl">Address</label>
                <input value={storeAddress} onChange={e => setStoreAddress(e.target.value)}
                  placeholder="3400 Van Hwy, Tyler TX 75702" className="inp" />
              </div>
              <div>
                <label className="lbl">Phone</label>
                <input type="tel" value={storePhone} onChange={e => setStorePhone(e.target.value)}
                  placeholder="(903) 555-0000" className="inp" />
              </div>
              <div>
                <label className="lbl">Store type</label>
                <select value={storeType} onChange={e => setStoreType(e.target.value)} className="inp">
                  <option>Gas Station / Convenience Store</option>
                  <option>Convenience Store Only</option>
                  <option>Gas Station Only</option>
                  <option>Liquor Store</option>
                  <option>Other Retail</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 mb-4">
              <Users className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-text mb-1">Add First Employee</h1>
            <p className="text-gray-500 text-sm mb-6">Add a cashier so they can clock in/out with their PIN</p>
            {!skipEmp && (
              <div className="space-y-4">
                <div>
                  <label className="lbl">Full name *</label>
                  <input value={empName} onChange={e => setEmpName(e.target.value)}
                    placeholder="Shayan Shaikh" className="inp" autoFocus />
                </div>
                <div>
                  <label className="lbl">Role</label>
                  <select value={empRole} onChange={e => setEmpRole(e.target.value)} className="inp">
                    {['Owner','Manager','Assistant Manager','Cashier','Stock Clerk'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">4-digit PIN *</label>
                  <input type="number" maxLength={4} value={empPin}
                    onChange={e => setEmpPin(e.target.value.slice(0,4))}
                    placeholder="1234" className="inp num text-center text-2xl tracking-widest" />
                </div>
                <div>
                  <label className="lbl">Hourly rate $</label>
                  <input type="number" step="0.01" value={empRate}
                    onChange={e => setEmpRate(e.target.value)} placeholder="15.00" className="inp" />
                </div>
              </div>
            )}
            <button onClick={() => setSkipEmp(v => !v)}
              className="mt-4 text-sm text-muted hover:text-sub underline">
              {skipEmp ? 'Add an employee instead' : 'Skip for now — I\'ll add employees later'}
            </button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 mx-auto mb-4">
              <BarChart3 className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-black text-text mb-2">You're all set! 🎉</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your store is ready. Go to Daily Reports to upload your first close report — 
              AI will read every number automatically.
            </p>
            <div className="space-y-3 text-left mb-6">
              {[
                { icon: '📊', text: 'Upload your Store Close report — AI reads it in seconds' },
                { icon: '💵', text: 'Check short/over without calculating anything' },
                { icon: '📦', text: 'Scan vendor invoices to update inventory automatically' },
                { icon: '👥', text: 'Employees clock in/out with their PIN' },
              ].map((tip, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-xl">{tip.icon}</span>
                  <span className="text-sm text-gray-700">{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6">
          {step === 1 && (
            <button onClick={createStore} disabled={loading || !storeName.trim()}
              className="btn btn-accent btn-full py-4 text-base gap-2">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Creating store…</> :
                <>Continue <ChevronRight className="h-5 w-5" /></>}
            </button>
          )}
          {step === 2 && (
            <button onClick={addEmployee} disabled={loading}
              className="btn btn-accent btn-full py-4 text-base gap-2">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Saving…</> :
                skipEmp ? <>Skip <ChevronRight className="h-5 w-5" /></> :
                <>Add Employee <ChevronRight className="h-5 w-5" /></>}
            </button>
          )}
          {step === 3 && (
            <button onClick={finish} className="btn btn-accent btn-full py-4 text-base gap-2">
              Go to Dashboard <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress text */}
      <p className="text-xs text-gray-400 mt-4">Step {step} of {STEPS.length}</p>
    </div>
  );
}
