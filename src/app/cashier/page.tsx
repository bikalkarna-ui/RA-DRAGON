'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  DollarSign, Package, FileText, CheckSquare, Clock,
  Loader2, Check, ChevronRight, ArrowLeft, Camera,
  AlertTriangle, Plus, X, Zap
} from 'lucide-react';
import Link from 'next/link';

// ── Safe Drop Screen ──────────────────────────────────────────────────────────
function SafeDropScreen({ store, onDone }: { store: any; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [error, setError] = useState('');

  const submit = async () => {
    if (!amount || !name) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/cashier-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'safe_drop', amount: parseFloat(amount), name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaving(false); setDone(true);
      setTimeout(() => { setAmount(''); setName(''); setDone(false); }, 2000);
    } catch (e: any) {
      setError(e.message || 'Failed — check internet connection');
      setSaving(false);
    }
  };

  if (done) return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500 mb-4">
        <Check className="h-10 w-10 text-white" />
      </div>
      <p className="text-2xl font-black text-text">Drop Recorded!</p>
      <p className="text-muted mt-2">{fmt.currency(parseFloat(amount))} by {name}</p>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-green-50 border-2 border-green-400 p-5 text-center mb-6">
        <DollarSign className="h-10 w-10 text-green-600 mx-auto mb-2" />
        <p className="font-black text-xl text-green-800">Record Safe Drop</p>
        <p className="text-sm text-green-600">This goes directly to today's report</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Your Name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Shayan" autoFocus
          className="w-full rounded-2xl border-2 border-gray-200 px-4 py-4 text-lg font-semibold focus:border-green-400 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Amount Dropped</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl font-bold">$</span>
          <input type="number" step="0.01" min="0"
            value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="0.00"
            className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-4 text-3xl font-black text-center focus:border-green-400 focus:outline-none" />
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button onClick={submit} disabled={!amount || !name || saving}
        className={cn('w-full rounded-2xl py-5 text-xl font-black text-white transition-all',
          amount && name ? 'bg-green-500 active:scale-95' : 'bg-gray-300')}>
        {saving ? 'Saving…' : 'Record Drop'}
      </button>

      <p className="text-xs text-center text-gray-400">
        Time: {new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} · Owner sees this instantly
      </p>
    </div>
  );
}

// ── Paid Out Screen ───────────────────────────────────────────────────────────
function PaidOutScreen({ store, onDone }: { store: any; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const REASONS = ['Vendor payment', 'Store supplies', 'Maintenance', 'Ice', 'Other'];

  const [error, setError] = useState('');

  const submit = async () => {
    if (!amount || !reason) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/cashier-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'paid_out', amount: parseFloat(amount), reason, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaving(false); setDone(true);
      setTimeout(() => { setAmount(''); setReason(''); setName(''); setDone(false); }, 2000);
    } catch (e: any) {
      setError(e.message || 'Failed — check internet connection');
      setSaving(false);
    }
  };

  if (done) return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 mb-4">
        <Check className="h-10 w-10 text-white" />
      </div>
      <p className="text-2xl font-black text-text">Paid Out Recorded!</p>
      <p className="text-muted mt-2">{fmt.currency(parseFloat(amount))} — {reason}</p>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-red-50 border-2 border-red-400 p-5 text-center mb-6">
        <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-2" />
        <p className="font-black text-xl text-red-800">Record Paid Out</p>
        <p className="text-sm text-red-600">Cash taken from register</p>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Reason</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={cn('rounded-xl py-3 text-sm font-bold border-2 transition-colors',
                reason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600')}>
              {r}
            </button>
          ))}
        </div>
        <input value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Or type reason…"
          className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-red-400 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Amount</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl font-bold">$</span>
          <input type="number" step="0.01" min="0"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-4 text-3xl font-black text-center focus:border-red-400 focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Your name (optional)</label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Bikal"
          className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-red-400 focus:outline-none" />
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button onClick={submit} disabled={!amount || !reason || saving}
        className={cn('w-full rounded-2xl py-5 text-xl font-black text-white transition-all',
          amount && reason ? 'bg-red-500 active:scale-95' : 'bg-gray-300')}>
        {saving ? 'Saving…' : 'Record Paid Out'}
      </button>
    </div>
  );
}

// ── Lottery Book Screen ───────────────────────────────────────────────────────
function LotteryScreen({ store, onDone }: { store: any; onDone: () => void }) {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [bookNum, setBookNum] = useState('');
  const [price, setPrice] = useState('5');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await createClient().from('timeline_events')
      .select('*').eq('store_id', store.id).eq('type', 'lottery_book')
      .order('created_at', { ascending: false }).limit(20);
    setBooks(data || []);
    setLoading(false);
  }, [store]);

  useEffect(() => { load(); }, [load]);

  const [errMsg, setErrMsg] = useState('');

  const activateBook = async () => {
    if (!bookNum) return;
    if (!store) { setErrMsg('Store not loaded yet — please wait a moment and try again'); return; }
    setSaving(true);
    setErrMsg('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const priceNum = parseFloat(price);
      if (!priceNum || isNaN(priceNum)) { setErrMsg('Please enter a valid ticket price'); return; }
      const { error } = await createClient().from('timeline_events').insert({
        store_id: store.id, event_date: today, type: 'lottery_book',
        title: `Book #${bookNum} Activated`,
        description: `$${price} scratch tickets — activated at ${new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`,
        amount: priceNum,
        metadata: JSON.stringify({ book: bookNum, price: priceNum, status: 'active', tickets_start: 1 }),
      });
      if (error) {
        console.error('activateBook failed:', error);
        setErrMsg(error.message || 'Could not save — please try again');
        return;
      }
      setBookNum(''); setAdding(false);
      load();
    } catch (err: any) {
      console.error('activateBook threw:', err);
      setErrMsg(err?.message || 'Something went wrong — please try again');
    } finally {
      setSaving(false);
    }
  };

  const closeBook = async (book: any) => {
    const sold = prompt('How many tickets sold from this book?');
    if (!sold) return;
    const { error } = await createClient().from('timeline_events').update({
      title: `Book #${JSON.parse(book.metadata||'{}').book} Closed`,
      description: `${sold} tickets sold · $${(parseInt(sold) * book.amount).toFixed(2)} total`,
      metadata: JSON.stringify({ ...JSON.parse(book.metadata||'{}'), status: 'closed', tickets_sold: parseInt(sold) }),
    }).eq('id', book.id);
    if (error) {
      console.error('closeBook failed:', error);
      alert(`Could not close book: ${error.message || 'please try again'}`);
      return;
    }
    load();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-amber-50 border-2 border-amber-400 p-4 text-center mb-2">
        <p className="font-black text-xl text-amber-800">Lottery Book Tracker</p>
        <p className="text-sm text-amber-600">Activate and close scratch ticket books — no writing needed</p>
      </div>

      <button onClick={() => setAdding(v => !v)}
        className={cn('w-full rounded-2xl py-4 text-lg font-black text-white',
          adding ? 'bg-gray-400' : 'bg-amber-500')}>
        {adding ? 'Cancel' : '+ Activate New Book'}
      </button>

      {adding && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Book Number</label>
            <input value={bookNum} onChange={e => setBookNum(e.target.value)}
              placeholder="e.g. 2739" autoFocus
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-xl font-black text-center focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Ticket Price</label>
            <div className="grid grid-cols-4 gap-2">
              {['1','2','5','10','20','25','30','50'].map(p => (
                <button key={p} onClick={() => setPrice(p)}
                  className={cn('rounded-xl py-2.5 text-sm font-bold border-2',
                    price === p ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-gray-200 bg-white text-gray-600')}>
                  ${p}
                </button>
              ))}
            </div>
          </div>
          <button onClick={activateBook} disabled={!bookNum || saving}
            className="w-full rounded-xl bg-amber-500 py-3 text-base font-black text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Activate Book'}
          </button>
          {errMsg && (
            <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {errMsg}
            </p>
          )}
        </div>
      )}

      {loading && <div className="text-center py-8"><Loader2 className="h-6 w-6 text-amber-500 animate-spin mx-auto" /></div>}

      {books.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Active Books</p>
          {books.map(b => {
            const meta = JSON.parse(b.metadata || '{}');
            const isActive = meta.status !== 'closed';
            return (
              <div key={b.id} className={cn('rounded-2xl border-2 p-4 flex items-center justify-between',
                isActive ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50 opacity-60')}>
                <div>
                  <p className="font-black text-text">Book #{meta.book || '—'}</p>
                  <p className="text-xs text-muted">${meta.price} tickets · {b.description}</p>
                  {meta.tickets_sold && <p className="text-xs text-green-600 font-bold">{meta.tickets_sold} sold · {fmt.currency(meta.tickets_sold * meta.price)}</p>}
                </div>
                {isActive && (
                  <button onClick={() => closeBook(b)}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white">
                    Close Book
                  </button>
                )}
                {!isActive && <span className="text-xs text-gray-400 font-bold">✓ Closed</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Vendor Delivery Screen ────────────────────────────────────────────────────
function VendorScreen({ store, onDone }: { store: any; onDone: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const VENDORS = ['Pepsi', 'Coca-Cola', 'Tyler Beverages', 'GG Distributing', 'Leaks Distributing', 'Prime', 'Brookshires', 'Other'];

  const scanInvoice = async () => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/scan-invoice', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.invoice) {
        setResult(data);
        setVendor(data.invoice.vendor_name || '');
        setAmount(String(data.invoice.total_amount || ''));
      }
    } catch {}
    setUploading(false);
  };

  const [error, setError] = useState('');

  const logDelivery = async () => {
    if (!vendor) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/cashier-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vendor_delivery', vendor, amount: parseFloat(amount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaving(false); setDone(true);
      setTimeout(() => { setVendor(''); setAmount(''); setFile(null); setResult(null); setDone(false); }, 2000);
    } catch (e: any) {
      setError(e.message || 'Failed — check internet connection');
      setSaving(false);
    }
  };

  if (done) return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 mb-4">
        <Check className="h-10 w-10 text-white" />
      </div>
      <p className="text-2xl font-black text-text">Delivery Recorded!</p>
      <p className="text-muted mt-2">{vendor} — {amount ? fmt.currency(parseFloat(amount)) : ''}</p>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-blue-50 border-2 border-blue-400 p-5 text-center mb-2">
        <Package className="h-10 w-10 text-blue-600 mx-auto mb-2" />
        <p className="font-black text-xl text-blue-800">Vendor Delivery</p>
        <p className="text-sm text-blue-600">Scan invoice or enter manually — goes to owner instantly</p>
      </div>

      {/* Photo scan option */}
      <div className="rounded-2xl border-2 border-dashed border-blue-300 p-4 text-center">
        <Camera className="h-8 w-8 text-blue-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-gray-700 mb-3">Photograph the invoice (optional)</p>
        <input type="file" accept="image/*" capture="environment"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); } }}
          className="hidden" id="vendor-photo" />
        <label htmlFor="vendor-photo"
          className="inline-block rounded-xl bg-blue-500 px-6 py-3 text-sm font-black text-white cursor-pointer active:scale-95">
          Take Photo / Upload
        </label>
        {file && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">{file.name}</p>
            <button onClick={scanInvoice} disabled={uploading}
              className="rounded-xl bg-violet-500 px-6 py-2 text-sm font-black text-white">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Reading…</> : '⚡ AI Read Invoice'}
            </button>
          </div>
        )}
        {result && <p className="text-xs text-green-600 font-bold mt-2">✓ Invoice read — {result.items?.length || 0} items found</p>}
      </div>

      {/* Manual entry */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Vendor Name</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {VENDORS.map(v => (
            <button key={v} onClick={() => setVendor(v)}
              className={cn('rounded-xl py-3 text-sm font-bold border-2 transition-colors',
                vendor === v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600')}>
              {v}
            </button>
          ))}
        </div>
        <input value={vendor} onChange={e => setVendor(e.target.value)}
          placeholder="Or type vendor name…"
          className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none" />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">Invoice Total</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">$</span>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-2xl border-2 border-gray-200 pl-10 pr-4 py-4 text-2xl font-black text-center focus:border-blue-400 focus:outline-none" />
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      <button onClick={logDelivery} disabled={!vendor || saving}
        className={cn('w-full rounded-2xl py-5 text-xl font-black text-white transition-all',
          vendor ? 'bg-blue-500 active:scale-95' : 'bg-gray-300')}>
        {saving ? 'Saving…' : 'Log Delivery'}
      </button>
    </div>
  );
}

// ── Main Cashier Page ─────────────────────────────────────────────────────────
type Screen = 'menu' | 'drop' | 'paidout' | 'vendor' | 'lottery';

export default function CashierPage() {
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const { store } = useStore();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const ACTIONS = [
    { id: 'drop' as Screen,    icon: DollarSign, label: 'Safe Drop',       sub: 'Record cash dropped into safe', color: 'bg-green-500', light: 'bg-green-50 text-green-700' },
    { id: 'paidout' as Screen, icon: AlertTriangle, label: 'Paid Out',     sub: 'Cash taken from register',      color: 'bg-red-500',   light: 'bg-red-50 text-red-700' },
    { id: 'vendor' as Screen,  icon: Package,    label: 'Vendor Arrived',  sub: 'Log delivery & scan invoice',   color: 'bg-blue-500',  light: 'bg-blue-50 text-blue-700' },
    { id: 'lottery' as Screen, icon: FileText,   label: 'Lottery Book',    sub: 'Activate or close a book',      color: 'bg-amber-500', light: 'bg-amber-50 text-amber-700' },
  ];

  if (!store) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        {screen !== 'menu' ? (
          <button onClick={() => setScreen('menu')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600">
            <span className="text-white font-black text-[9px] tracking-tight">RX</span>
          </div>
        )}
        <div>
          <p className="font-black text-text text-lg leading-tight">
            {screen === 'menu' ? 'Cashier Actions' :
             screen === 'drop' ? 'Safe Drop' :
             screen === 'paidout' ? 'Paid Out' :
             screen === 'vendor' ? 'Vendor Delivery' : 'Lottery Books'}
          </p>
          <p className="text-xs text-muted">{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</p>
        </div>
        <div className="ml-auto">
          <Link href="/home" className="text-xs text-muted hover:text-accent">Manager →</Link>
        </div>
      </div>

      {/* Menu */}
      {screen === 'menu' && (
        <div className="p-4 space-y-3">
          <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 p-5 text-white mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">No paperwork needed</p>
            <p className="font-black text-xl">Everything goes to the owner's app instantly</p>
          </div>

          {ACTIONS.map(a => (
            <button key={a.id} onClick={() => setScreen(a.id)}
              className="w-full rounded-2xl bg-white border-2 border-gray-100 p-5 flex items-center gap-4 active:scale-95 transition-transform text-left">
              <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', a.color)}>
                <a.icon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-text text-lg">{a.label}</p>
                <p className="text-sm text-muted">{a.sub}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300" />
            </button>
          ))}

          <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-violet-800">Everything is automatic</p>
            </div>
            <p className="text-xs text-violet-600">Safe drops, paid outs, and deliveries all go directly into today's daily report. Owner sees everything instantly from their phone.</p>
          </div>
        </div>
      )}

      {screen === 'drop'    && <SafeDropScreen  store={store} onDone={() => setScreen('menu')} />}
      {screen === 'paidout' && <PaidOutScreen   store={store} onDone={() => setScreen('menu')} />}
      {screen === 'vendor'  && <VendorScreen    store={store} onDone={() => setScreen('menu')} />}
      {screen === 'lottery' && <LotteryScreen   store={store} onDone={() => setScreen('menu')} />}
    </div>
  );
}
