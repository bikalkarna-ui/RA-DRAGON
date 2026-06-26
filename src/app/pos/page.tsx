'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Upload, Loader2, Camera, CheckCircle, AlertCircle, Plus, TrendingUp, TrendingDown, Clock, FileText, Scan, User, CreditCard, DollarSign, Smartphone, Check, Minus, Trash2, Search, Printer, X } from 'lucide-react';
import { format, startOfDay } from 'date-fns';

type View = 'dashboard' | 'pos' | 'close_till';

// ─── Scanner + Upload combo component ──────────────────────────────────────
function ScanUpload({ endpoint, onResult, label, extraFields }: { endpoint: string; onResult: (d: any) => void; label: string; extraFields?: Record<string, string> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'scanning' | 'uploading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (file?: File, manualData?: string) => {
    setState('uploading'); setMsg('');
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (manualData) fd.append('manual_data', manualData);
      if (extraFields) Object.entries(extraFields).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setState('error'); setMsg(data.error || 'Failed'); return; }
      setState('done'); onResult(data); setTimeout(() => setState('idle'), 4000);
    } catch (err: any) { setState('error'); setMsg(err.message); }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) submit(f); }} />
      {state === 'idle' && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-5 hover:border-accent hover:bg-red-50 transition-all">
            <Upload className="h-8 w-8 text-dim" />
            <span className="text-sm font-semibold text-sub">Upload Report</span>
            <span className="text-xs text-muted">PDF or photo</span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-green-200 bg-green-50 p-5 hover:border-green-400 transition-all">
            <Camera className="h-8 w-8 text-green-500" />
            <span className="text-sm font-semibold text-green-700">Scan / Photo</span>
            <span className="text-xs text-green-500">Use camera</span>
          </button>
        </div>
      )}
      {state === 'uploading' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border p-8">
          <Loader2 className="h-10 w-10 text-accent animate-spin" />
          <p className="font-semibold text-text">AI is reading your report…</p>
          <p className="text-muted text-sm">Extracting all numbers automatically</p>
        </div>
      )}
      {state === 'done' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
          <p className="font-semibold text-green-800">Report processed!</p>
          <p className="text-green-600 text-sm">Daily close report updated automatically</p>
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-6">
          <AlertCircle className="h-10 w-10 text-accent" />
          <p className="font-semibold text-accent">Failed</p>
          <p className="text-muted text-sm">{msg}</p>
          <button onClick={() => setState('idle')} className="text-xs text-accent underline">Try again</button>
        </div>
      )}
    </div>
  );
}

// ─── Daily Close Report (matches the image exactly) ────────────────────────
function DailyCloseReport({ report, tillCount }: { report: any; tillCount: number }) {
  const n = (v: any) => Number(v || 0);
  const shortOver = n(report.short_over);
  const isShort = shortOver < 0;
  const isOver = shortOver > 0;

  const Row = ({ label, value, bold, red, green }: { label: string; value: number; bold?: boolean; red?: boolean; green?: boolean }) => (
    <div className={cn('flex justify-between items-center py-1.5 border-b border-gray-50', bold && 'font-bold')}>
      <span className={cn('text-sm', red ? 'text-accent' : green ? 'text-green-700' : 'text-gray-700')}>{label}</span>
      <span className={cn('num text-sm', bold ? 'font-bold' : 'font-medium', red ? 'text-accent' : green ? 'text-green-700' : 'text-gray-900')}>{fmt.currency(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="tile p-4 bg-gray-900 border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Daily Close Report</p>
            <p className="text-white font-black text-lg">{format(new Date(report.report_date + 'T12:00:00'), 'MMMM d, yyyy · EEEE')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{tillCount} close{tillCount !== 1 ? 's' : ''} submitted</p>
            <p className="num text-2xl font-black text-white">{fmt.currency(report.total_sales)}</p>
            <p className="text-xs text-gray-400">Total Sales</p>
          </div>
        </div>
      </div>

      {/* SHORT / OVER — most important */}
      <div className={cn('tile p-5 border-2', shortOver === 0 ? 'border-gray-200' : isShort ? 'border-accent bg-red-50' : 'border-green-400 bg-green-50')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">SHORT / OVER</p>
            <p className={cn('num text-4xl font-black mt-1', shortOver === 0 ? 'text-gray-900' : isShort ? 'text-accent' : 'text-green-700')}>
              {isShort ? '' : isOver ? '+' : ''}{fmt.currency(shortOver)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div><p className="text-xs text-gray-500">Cash Expected</p><p className="num font-bold text-gray-900">{fmt.currency(report.cash_expected)}</p></div>
            <div><p className="text-xs text-gray-500">Cash Actual</p><p className="num font-bold text-gray-900">{fmt.currency(report.cash_actual)}</p></div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {shortOver === 0 ? 'Drawer is exact — great job!' : isShort ? `Drawer is short by ${fmt.currency(Math.abs(shortOver))} — investigate` : `Drawer is over by ${fmt.currency(shortOver)}`}
        </p>
      </div>

      {/* Cash to Deposit */}
      <div className="tile p-5 border-l-4 border-l-accent">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Cash Flow</p>
        <Row label="ATM (MAC)" value={n(report.atm_total)} />
        <Row label="Checks" value={n(report.checks_total)} />
        <Row label="Cash in Drawer" value={n(report.cash_in_drawer)} />
        <Row label="Net Cash" value={n(report.net_cash)} />
        <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-accent">
          <span className="font-black text-text">TOTAL CASH FLOW</span>
          <span className="num font-black text-accent text-xl">{fmt.currency(report.total_cash_flow)}</span>
        </div>
      </div>

      {/* Two column: Departments + T.Sales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="tile p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Department Sales</p>
          <Row label="Tax" value={n(report.dept_tax)} />
          <Row label="Non Tax" value={n(report.dept_nontax)} />
          <Row label="CIG" value={n(report.dept_cig)} />
          <Row label="Beer & Wine" value={n(report.dept_beer_wine)} />
          <Row label="Novelty" value={n(report.dept_novelty)} />
          <Row label="Vape" value={n(report.dept_vape)} />
          <Row label="Unknown UPC" value={n(report.dept_unknown_upc)} />
          <Row label="Inventory" value={0} />
          <Row label="Purchase" value={n(report.purchase_paid)} />
          <Row label="Sales" value={n(report.total_sales)} />
          <Row label="Closing" value={0} />
        </div>

        <div className="tile p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">T.Sales</p>
          <Row label="Lotto" value={n(report.lotto_sales)} />
          <Row label="Lottery" value={n(report.lottery_sales)} />
          <Row label="Unleaded" value={n(report.fuel_unleaded)} />
          <Row label="Midgrade" value={n(report.fuel_midgrade)} />
          <Row label="Premium" value={n(report.fuel_premium)} />
          <Row label="Diesel" value={n(report.fuel_diesel)} />
          <Row label="M.Order" value={n(report.money_order_sales)} />
          <Row label="M.Order Fee" value={n(report.money_order_fee)} />
          <Row label="Sales Tax" value={n(report.sales_tax_collected)} />
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 mt-1">T.Cash Flow</p>
            <Row label="T.Cash Flow" value={n(report.total_cash_flow)} />
            <Row label="CreditCard" value={n(report.credit_card_total)} />
            <Row label="EBT" value={n(report.ebt_total)} />
            <Row label="Checks" value={n(report.check_total)} />
            <Row label="Coupons" value={n(report.coupon_total)} />
            <Row label="MAC Payout" value={n(report.mac_payout)} />
            <Row label="Purchase Paid" value={n(report.purchase_paid)} />
            <Row label="Lotto Paid" value={n(report.lotto_paid)} />
            <Row label="Lottery Paid" value={n(report.lottery_paid)} />
          </div>
        </div>
      </div>

      {/* Totals row */}
      <div className="tile p-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { l: 'Total In', v: report.total_in, green: true },
            { l: 'Total Out', v: report.total_out, red: true },
            { l: 'Gross', v: report.gross },
            { l: 'Net', v: report.net, bold: true },
          ].map(k => (
            <div key={k.l} className={cn('rounded-xl p-3', k.green ? 'bg-green-50' : k.red ? 'bg-red-50' : 'bg-gray-50')}>
              <p className="text-xs text-gray-500 font-medium">{k.l}</p>
              <p className={cn('num font-black text-lg mt-1', k.green ? 'text-green-700' : k.red ? 'text-accent' : 'text-gray-900')}>{fmt.currency(Number(k.v || 0))}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cash Flow section */}
      <div className="tile p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Cash Flow Summary</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">CASH IN</p>
            <Row label="Day Close Total In" value={n(report.day_close_total_in)} />
            <Row label="MAC In" value={n(report.mac_in)} />
            <div className="flex justify-between pt-2 font-bold"><span className="text-sm">Total Day In</span><span className="num text-sm">{fmt.currency(n(report.day_close_total_in) + n(report.mac_in))}</span></div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">CASH OUT</p>
            <Row label="Day Close Total Out" value={n(report.day_close_total_out)} />
            <Row label="MAC Out" value={n(report.mac_out)} />
            <div className="flex justify-between pt-2 font-bold"><span className="text-sm">Total Day Out</span><span className="num text-sm">{fmt.currency(n(report.day_close_total_out) + n(report.mac_out))}</span></div>
          </div>
        </div>
      </div>

      {/* Deposit */}
      <div className="tile p-4 bg-accent text-white border-0">
        <p className="text-xs font-bold uppercase tracking-wide text-red-200 mb-3">Deposit</p>
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex justify-between gap-8"><span className="text-red-200 text-sm">MAC Deposit</span><span className="num font-bold">{fmt.currency(report.mac_deposit)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-red-200 text-sm">Store Deposit</span><span className="num font-bold">{fmt.currency(report.store_deposit)}</span></div>
          </div>
          <div className="text-right">
            <p className="text-red-200 text-xs">TOTAL DEPOSIT</p>
            <p className="num text-3xl font-black">{fmt.currency(report.total_deposit)}</p>
          </div>
        </div>
      </div>

      {/* Fuel ATG */}
      {(n(report.atg_unleaded) + n(report.atg_midgrade) + n(report.atg_premium) + n(report.atg_diesel)) > 0 && (
        <div className="tile p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Daily ATG Reading</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'Unleaded', v: report.atg_unleaded },
              { l: 'Midgrade', v: report.atg_midgrade },
              { l: 'Premium', v: report.atg_premium },
              { l: 'Diesel', v: report.atg_diesel },
            ].map(f => (
              <div key={f.l} className="text-center bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{f.l}</p>
                <p className="num font-bold text-gray-900 mt-1">{Number(f.v || 0).toFixed(1)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor Activities */}
      {report.vendor_activities?.length > 0 && (
        <div className="tile overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Vendor Activities</p>
          </div>
          <div className="divide-y divide-gray-50">
            {report.vendor_activities.map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium text-gray-900">{v.vendor}</span>
                <div className="flex items-center gap-4 text-gray-500">
                  <span>Retail: <span className="num font-semibold text-gray-900">{fmt.currency(v.retail)}</span></span>
                  <span>Cost: <span className="num font-semibold text-gray-900">{fmt.currency(v.cost)}</span></span>
                  <span className="chip-gray">{v.mop}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS Register ───────────────────────────────────────────────────────────
function POSRegister({ store }: { store: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [payment, setPayment] = useState('cash');
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const buf = useRef(''); const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from('products').select('id,name,unit_price,unit_cost,quantity,taxable,vendor_company,sku,barcode,department').eq('store_id', store.id).eq('is_active', true).order('name'),
      sb.from('employees').select('id,name,role').eq('store_id', store.id).eq('is_active', true),
    ]).then(([{ data: p }, { data: e }]) => { setProducts(p ?? []); setEmployees(e ?? []); });
  }, [store.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && buf.current.length > 2) {
        const code = buf.current.trim();
        const prod = products.find(p => p.barcode === code || p.sku === code);
        if (prod) add(prod); else setSearch(code);
        buf.current = ''; return;
      }
      if (e.key.length === 1 && document.activeElement !== searchRef.current) {
        buf.current += e.key; clearTimeout(timer.current);
        timer.current = setTimeout(() => { buf.current = ''; }, 80);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [products]);

  const filtered = products.filter(p => { const q = search.toLowerCase(); return p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q); });
  const add = (p: any) => setCart(c => { const ex = c.find(i => i.product.id === p.id); return ex ? c.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { product: p, qty: 1 }]; });
  const chg = (id: string, d: number) => setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));

  const tax_rate = store?.tax_rate ?? 0.0825;
  let sub = 0, tax = 0;
  for (const i of cart) { const l = Number(i.product.unit_price) * i.qty; sub += l; if (i.product.taxable) tax += l * tax_rate; }
  tax = Math.round(tax * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;

  const pinLogin = async () => {
    const { data } = await createClient().from('employees').select('*').eq('store_id', store.id).eq('pin', pinInput).eq('is_active', true).maybeSingle();
    if (data) { setEmployee(data); setPinInput(''); setPinErr(''); setShowPin(false); } else setPinErr('Wrong PIN');
  };

  const complete = async () => {
    if (!store || cart.length === 0) return; setSaving(true);
    const sb = createClient();
    const { data: sale } = await sb.from('sales').insert({ store_id: store.id, employee_id: employee?.id ?? null, employee_name: employee?.name ?? null, subtotal: sub, tax, total, payment_method: payment, source: 'pos' }).select('id').single();
    if (sale) {
      await sb.from('sale_items').insert(cart.map(i => ({ sale_id: sale.id, product_id: i.product.id, product_name: i.product.name, vendor_company: i.product.vendor_company, department: i.product.department, sku: i.product.sku, quantity: i.qty, unit_price: i.product.unit_price, unit_cost: i.product.unit_cost, taxable: i.product.taxable, line_total: Number(i.product.unit_price) * i.qty })));
      for (const i of cart) {
        const newQty = Math.max(0, i.product.quantity - i.qty);
        await sb.from('products').update({ quantity: newQty, last_sold_at: new Date().toISOString() }).eq('id', i.product.id);
      }
    }
    setDone({ cart, sub, tax, total, date: new Date(), employee, payment }); setCart([]); setSaving(false);
  };

  if (done) return (
    <div className="space-y-4">
      <div id="receipt" className="tile p-6 font-mono text-sm">
        <div className="border-b border-border pb-4 mb-4 text-center">
          <p className="font-black text-gray-900 text-lg">{store.name}</p>
          <p className="text-muted text-xs">{format(done.date, 'MMM d, yyyy · h:mm a')}</p>
          {done.employee && <p className="text-muted text-xs">Cashier: {done.employee.name}</p>}
        </div>
        <div className="space-y-2 pb-4 border-b border-dashed border-border">
          {done.cart.map((i: any) => <div key={i.product.id} className="flex justify-between text-xs"><span className="text-sub">{i.qty}× {i.product.name}</span><span className="num text-gray-900">{fmt.currency(i.product.unit_price * i.qty)}</span></div>)}
        </div>
        <div className="pt-4 space-y-2 text-xs">
          <div className="flex justify-between text-sub"><span>Subtotal</span><span className="num">{fmt.currency(done.sub)}</span></div>
          <div className="flex justify-between text-sub"><span>Tax</span><span className="num">{fmt.currency(done.tax)}</span></div>
          <div className="flex justify-between font-black text-gray-900 border-t border-border pt-2 mt-1"><span>TOTAL</span><span className="num text-accent">{fmt.currency(done.total)}</span></div>
          <div className="flex justify-between text-dim capitalize"><span>Payment</span><span>{done.payment}</span></div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => window.print()} className="btn btn-ghost flex-1 no-print"><Printer className="h-4 w-4" />Print</button>
        <button onClick={() => setDone(null)} className="btn btn-accent flex-1">New Sale</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-5">
          <div className="tile w-full max-w-xs p-6">
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold text-text">Staff PIN</h2><button onClick={() => { setShowPin(false); setPinInput(''); }} className="text-muted"><X className="h-5 w-5" /></button></div>
            <div className="text-center mb-4 text-3xl font-mono tracking-widest text-text min-h-10">{pinInput.length > 0 ? '•'.repeat(pinInput.length) : <span className="text-dim text-lg">Enter PIN</span>}</div>
            {pinErr && <p className="text-center text-sm text-accent mb-3">{pinErr}</p>}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => (
                <button key={String(k)} onClick={() => { if (k === '⌫') setPinInput(p => p.slice(0, -1)); else if (k !== '') setPinInput(p => p + k); }}
                  className={cn('h-13 rounded-xl text-lg font-semibold active:scale-95 transition-transform', k === '' ? 'opacity-0 pointer-events-none' : 'bg-surface text-text hover:bg-border')}>
                  {k}
                </button>
              ))}
            </div>
            <button onClick={pinLogin} disabled={pinInput.length < 4} className="btn btn-accent btn-full">Login</button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" /><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scan barcode…" className="inp pl-11" autoFocus /></div>
        <button onClick={() => setShowPin(true)} className={cn('flex items-center gap-1.5 rounded-xl border px-3 text-sm font-medium', employee ? 'border-green-300 bg-green-50 text-green-700' : 'border-border bg-surface text-sub')}>
          <User className="h-4 w-4" />{employee ? employee.name.split(' ')[0] : 'Staff'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {filtered.map(p => (
          <button key={p.id} onClick={() => add(p)} disabled={p.quantity === 0} className="tile p-4 text-left active:scale-95 transition-transform disabled:opacity-40">
            {p.department && <p className="text-[10px] text-muted mb-1 uppercase tracking-wide">{p.department}</p>}
            <p className="text-sm font-bold text-text leading-snug">{p.name}</p>
            <p className="num text-lg font-black text-accent mt-2">{fmt.currency(p.unit_price)}</p>
            <p className={cn('text-[10px] mt-1 font-medium', p.quantity === 0 ? 'text-accent' : p.quantity <= 5 ? 'text-amber-600' : 'text-gray-400')}>
              {p.quantity === 0 ? '⚠ Out of stock' : `${p.quantity} in stock`}
            </p>
          </button>
        ))}
        {filtered.length === 0 && <p className="col-span-2 py-10 text-center text-muted text-sm">No products found.</p>}
      </div>

      {cart.length > 0 && (
        <div className="tile overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <p className="font-bold text-text">Cart</p>
            <span className="chip-gray">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
          </div>
          <div className="divide-y divide-border/60">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-text truncate">{item.product.name}</p><p className="num text-xs text-muted">{fmt.currency(item.product.unit_price)}</p></div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => chg(item.product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-sub hover:text-text active:scale-95"><Minus className="h-3.5 w-3.5" /></button>
                  <span className="num w-6 text-center font-bold text-text">{item.qty}</span>
                  <button onClick={() => chg(item.product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-sub hover:text-text active:scale-95"><Plus className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setCart(c => c.filter(i => i.product.id !== item.product.id))} className="flex h-8 w-8 items-center justify-center rounded-lg text-dim hover:text-accent hover:bg-red-50 active:scale-95 ml-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-sub"><span>Subtotal</span><span className="num">{fmt.currency(sub)}</span></div>
              <div className="flex justify-between text-sub"><span>Tax ({((store?.tax_rate ?? 0.0825) * 100).toFixed(2)}%)</span><span className="num">{fmt.currency(tax)}</span></div>
              <div className="flex justify-between font-black text-text border-t border-border pt-1.5"><span>Total</span><span className="num text-accent text-lg">{fmt.currency(total)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'cash', l: 'Cash', i: DollarSign }, { id: 'credit', l: 'Credit', i: CreditCard }, { id: 'debit', l: 'Debit', i: CreditCard }, { id: 'mobile', l: 'Mobile', i: Smartphone }].map(pm => {
                const Icon = pm.i;
                return <button key={pm.id} onClick={() => setPayment(pm.id)} className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition-colors', payment === pm.id ? 'border-accent bg-red-50 text-accent' : 'border-border text-sub hover:text-text')}><Icon className="h-4 w-4" />{pm.l}</button>;
              })}
            </div>
            <button onClick={complete} disabled={saving} className="btn btn-accent btn-full py-4 text-base">
              {saving ? 'Processing…' : <><Check className="h-5 w-5" />Complete · {fmt.currency(total)}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Daily Sales Page ──────────────────────────────────────────────────
export default function DailySalesPage() {
  const { store } = useStore();
  const [view, setView] = useState<View>('dashboard');
  const [report, setReport] = useState<any>(null);
  const [tillCount, setTillCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayTxns, setTodayTxns] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const today = new Date().toISOString().split('T')[0];
    const todayStart = startOfDay(new Date()).toISOString();
    const [{ data: rpt }, { data: tills }, { data: sales }, { data: emps }] = await Promise.all([
      sb.from('daily_close_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
      sb.from('till_readings').select('id,employee_name,reading_time,cash_counted').eq('store_id', store.id).eq('reading_date', today).order('reading_time', { ascending: false }),
      sb.from('sales').select('total').eq('store_id', store.id).gte('created_at', todayStart),
      sb.from('employees').select('id,name').eq('store_id', store.id).eq('is_active', true),
    ]);
    setReport(rpt); setTillCount((tills ?? []).length);
    setTodayTotal((sales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0));
    setTodayTxns((sales ?? []).length);
    setEmployees(emps ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTillResult = (data: any) => {
    setReport(data.report);
    setTillCount(data.tillCount);
    loadData();
    setView('dashboard');
  };

  const now = new Date();

  return (
    <Screen title="Daily Sales" subtitle={format(now, 'EEEE, MMMM d · h:mm a')}>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { id: 'dashboard', label: 'Today\'s Report' },
          { id: 'pos', label: 'POS Register' },
          { id: 'close_till', label: 'Close Till' },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id as View)}
            className={cn('flex-none rounded-full px-5 py-2 text-sm font-bold transition-colors',
              view === t.id ? 'bg-accent text-white' : 'bg-surface text-sub border border-border hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard view */}
      {view === 'dashboard' && (
        <div className="space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'POS Sales', v: fmt.currency(todayTotal), sub: `${todayTxns} txns` },
              { l: 'Till Closes', v: String(tillCount), sub: 'submitted today' },
              { l: 'Short/Over', v: report ? (Number(report.short_over) >= 0 ? '+' : '') + fmt.currency(report.short_over ?? 0) : '—', red: report && Number(report.short_over) < 0, green: report && Number(report.short_over) > 0 },
            ].map(k => (
              <div key={k.l} className={cn('tile p-4 text-center', (k as any).red && 'border-accent border-2', (k as any).green && 'border-green-400 border-2')}>
                <p className="text-xs text-muted font-medium mb-1">{k.l}</p>
                <p className={cn('num font-black text-xl', (k as any).red ? 'text-accent' : (k as any).green ? 'text-green-700' : 'text-text')}>{k.v}</p>
                {k.sub && <p className="text-xs text-dim mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          {report ? (
            <DailyCloseReport report={report} tillCount={tillCount} />
          ) : (
            <div className="tile p-10 text-center">
              <Clock className="mx-auto h-12 w-12 text-dim mb-4" />
              <p className="font-bold text-text text-lg mb-2">No close report yet today</p>
              <p className="text-muted text-sm mb-5">When an employee submits their close-till report, the daily report builds automatically. You can also submit one manually.</p>
              <button onClick={() => setView('close_till')} className="btn btn-accent px-6">Submit Close Till Report</button>
            </div>
          )}
        </div>
      )}

      {/* POS Register */}
      {view === 'pos' && store && <POSRegister store={store} />}

      {/* Close Till submission */}
      {view === 'close_till' && (
        <div className="space-y-5">
          <div className="tile p-5">
            <p className="font-bold text-text mb-1">Submit Close Till Report</p>
            <p className="text-sm text-muted mb-4">Upload or scan the till close sheet. AI reads every number and updates today's daily report automatically. Multiple employees can submit — all are combined.</p>

            {employees.length > 0 && (
              <div className="mb-4">
                <label className="lbl">Which employee is closing?</label>
                <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="inp">
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}

            <ScanUpload
              endpoint="/api/scan-till"
              onResult={handleTillResult}
              label="Upload or Scan Close Till Report"
              extraFields={{ employee_id: selectedEmp, employee_name: employees.find(e => e.id === selectedEmp)?.name || 'Unknown' }}
            />
          </div>

          <div className="tile p-5">
            <p className="text-sm font-bold text-text mb-4">Or enter manually</p>
            <ManualTillForm store={store} employees={employees} onDone={handleTillResult} />
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─── Manual till entry form ─────────────────────────────────────────────────
function ManualTillForm({ store, employees, onDone }: { store: any; employees: any[]; onDone: (d: any) => void }) {
  const [form, setForm] = useState({
    employee_id: '', employee_name: '',
    cash_counted: '', checks_counted: '', atm_total: '',
    cash_sales: '', credit_sales: '', debit_sales: '', ebt_sales: '',
    mac_payout: '', lotto_paid: '', lottery_paid: '', purchase_paid: '',
    dept_tax: '', dept_nontax: '', dept_cig: '', dept_beer_wine: '', dept_novelty: '', dept_vape: '', dept_unknown_upc: '',
    lotto_sales: '', lottery_sales: '', money_order_sales: '', money_order_fee: '',
    fuel_unleaded_gallons: '', fuel_midgrade_gallons: '', fuel_premium_gallons: '', fuel_diesel_gallons: '',
    fuel_unleaded_sales: '', fuel_midgrade_sales: '', fuel_premium_sales: '', fuel_diesel_sales: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData();
    fd.append('manual_data', JSON.stringify(form));
    fd.append('employee_id', form.employee_id);
    fd.append('employee_name', form.employee_name || employees.find(emp => emp.id === form.employee_id)?.name || 'Unknown');
    const res = await fetch('/api/scan-till', { method: 'POST', body: fd });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onDone(data);
  };

  const Field = ({ k, label, type = 'number' }: { k: string; label: string; type?: string }) => (
    <div><label className="lbl text-xs">{label}</label><input type={type} step="0.01" min="0" value={(form as any)[k]} onChange={e => f(k, e.target.value)} className="inp h-9 text-sm" placeholder="0.00" /></div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {employees.length > 0 && (
        <div><label className="lbl">Employee</label>
          <select value={form.employee_id} onChange={e => f('employee_id', e.target.value)} className="inp">
            <option value="">— Select —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <p className="section-title">Cash Drawer</p>
        <div className="grid grid-cols-3 gap-2">
          <Field k="cash_counted" label="Cash Counted $" />
          <Field k="checks_counted" label="Checks $" />
          <Field k="atm_total" label="ATM/MAC $" />
        </div>
      </div>
      <div>
        <p className="section-title">Sales by Payment</p>
        <div className="grid grid-cols-2 gap-2">
          <Field k="cash_sales" label="Cash Sales $" />
          <Field k="credit_sales" label="Credit Card $" />
          <Field k="debit_sales" label="Debit $" />
          <Field k="ebt_sales" label="EBT $" />
        </div>
      </div>
      <div>
        <p className="section-title">Payouts</p>
        <div className="grid grid-cols-2 gap-2">
          <Field k="mac_payout" label="MAC Payout $" />
          <Field k="lotto_paid" label="Lotto Paid $" />
          <Field k="lottery_paid" label="Lottery Paid $" />
          <Field k="purchase_paid" label="Purchase Paid $" />
        </div>
      </div>
      <div>
        <p className="section-title">Department Sales</p>
        <div className="grid grid-cols-2 gap-2">
          <Field k="dept_tax" label="Tax $" />
          <Field k="dept_nontax" label="Non Tax $" />
          <Field k="dept_cig" label="CIG $" />
          <Field k="dept_beer_wine" label="Beer & Wine $" />
          <Field k="dept_novelty" label="Novelty $" />
          <Field k="dept_vape" label="Vape $" />
          <Field k="dept_unknown_upc" label="Unknown UPC $" />
          <Field k="lotto_sales" label="Lotto Sales $" />
          <Field k="lottery_sales" label="Lottery Sales $" />
          <Field k="money_order_sales" label="M.Order Sales $" />
          <Field k="money_order_fee" label="M.Order Fee $" />
        </div>
      </div>
      <div>
        <p className="section-title">Fuel</p>
        <div className="grid grid-cols-2 gap-2">
          <Field k="fuel_unleaded_gallons" label="Unleaded Gallons" />
          <Field k="fuel_unleaded_sales" label="Unleaded Sales $" />
          <Field k="fuel_midgrade_gallons" label="Midgrade Gallons" />
          <Field k="fuel_midgrade_sales" label="Midgrade Sales $" />
          <Field k="fuel_premium_gallons" label="Premium Gallons" />
          <Field k="fuel_premium_sales" label="Premium Sales $" />
          <Field k="fuel_diesel_gallons" label="Diesel Gallons" />
          <Field k="fuel_diesel_sales" label="Diesel Sales $" />
        </div>
      </div>
      <div><label className="lbl">Notes</label><input value={form.notes} onChange={e => f('notes', e.target.value)} className="inp" placeholder="Optional" /></div>
      <button type="submit" disabled={saving} className="btn btn-accent btn-full py-4">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Check className="h-4 w-4" />Submit Close Till</>}
      </button>
    </form>
  );
}
