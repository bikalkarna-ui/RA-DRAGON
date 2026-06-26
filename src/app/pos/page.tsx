'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import {
  Plus, Minus, Trash2, Search, Check, User, CreditCard,
  DollarSign, Smartphone, X, Printer, Clock, Loader2
} from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';
import { format, startOfDay } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────
type View = 'report' | 'pos' | 'close_till';

// ─── Manual Entry Form ──────────────────────────────────────────────────────
function ManualEntry({ onDone }: { onDone: (data: any) => void }) {
  const { store } = useStore();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState({
    employee_id: '', cash_counted: '', checks_counted: '', atm_total: '',
    cash_sales: '', credit_sales: '', debit_sales: '', ebt_sales: '',
    mac_payout: '', lotto_paid: '', lottery_paid: '', purchase_paid: '',
    dept_tax: '', dept_nontax: '', dept_cig: '', dept_beer_wine: '',
    dept_novelty: '', dept_vape: '', dept_unknown_upc: '',
    lotto_sales: '', lottery_sales: '', money_order_sales: '', money_order_fee: '',
    fuel_unleaded_gallons: '', fuel_midgrade_gallons: '', fuel_premium_gallons: '', fuel_diesel_gallons: '',
    fuel_unleaded_sales: '', fuel_midgrade_sales: '', fuel_premium_sales: '', fuel_diesel_sales: '',
    notes: '',
  });
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const n = (v: string) => parseFloat(v) || 0;

  useEffect(() => {
    if (!store) return;
    createClient().from('employees').select('id,name').eq('store_id', store.id).eq('is_active', true)
      .then(({ data }) => setEmployees(data ?? []));
  }, [store]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const fd = new FormData();
    fd.append('manual_data', JSON.stringify({
      cash_counted: n(form.cash_counted), checks_counted: n(form.checks_counted), atm_total: n(form.atm_total),
      cash_sales: n(form.cash_sales), credit_sales: n(form.credit_sales), debit_sales: n(form.debit_sales), ebt_sales: n(form.ebt_sales),
      mac_payout: n(form.mac_payout), lotto_paid: n(form.lotto_paid), lottery_paid: n(form.lottery_paid), purchase_paid: n(form.purchase_paid),
      dept_tax: n(form.dept_tax), dept_nontax: n(form.dept_nontax), dept_cig: n(form.dept_cig), dept_beer_wine: n(form.dept_beer_wine),
      dept_novelty: n(form.dept_novelty), dept_vape: n(form.dept_vape), dept_unknown_upc: n(form.dept_unknown_upc),
      lotto_sales: n(form.lotto_sales), lottery_sales: n(form.lottery_sales),
      money_order_sales: n(form.money_order_sales), money_order_fee: n(form.money_order_fee),
      fuel_unleaded_gallons: n(form.fuel_unleaded_gallons), fuel_midgrade_gallons: n(form.fuel_midgrade_gallons),
      fuel_premium_gallons: n(form.fuel_premium_gallons), fuel_diesel_gallons: n(form.fuel_diesel_gallons),
      fuel_unleaded_sales: n(form.fuel_unleaded_sales), fuel_midgrade_sales: n(form.fuel_midgrade_sales),
      fuel_premium_sales: n(form.fuel_premium_sales), fuel_diesel_sales: n(form.fuel_diesel_sales),
    }));
    const emp = employees.find(e => e.id === form.employee_id);
    fd.append('employee_id', form.employee_id);
    fd.append('employee_name', emp?.name ?? 'Unknown');
    const res = await fetch('/api/scan-till', { method: 'POST', body: fd });
    const data = await res.json();
    setSaving(false);
    if (res.ok) onDone(data);
  };

  const F = ({ k, label }: { k: string; label: string }) => (
    <div>
      <label className="text-xs text-gray-500 font-medium block mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input type="number" step="0.01" min="0" value={(form as any)[k]} onChange={e => f(k, e.target.value)}
          className="inp h-9 pl-7 text-sm" placeholder="0.00" />
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      {employees.length > 0 && (
        <div>
          <label className="lbl">Employee</label>
          <select value={form.employee_id} onChange={e => f('employee_id', e.target.value)} className="inp">
            <option value="">— Select —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Cash Drawer</p>
        <div className="grid grid-cols-3 gap-2">
          <F k="cash_counted" label="Cash Counted" />
          <F k="checks_counted" label="Checks" />
          <F k="atm_total" label="ATM / MAC" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Sales by Payment</p>
        <div className="grid grid-cols-2 gap-2">
          <F k="cash_sales" label="Cash Sales" />
          <F k="credit_sales" label="Credit Card" />
          <F k="debit_sales" label="Debit" />
          <F k="ebt_sales" label="EBT" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Payouts</p>
        <div className="grid grid-cols-2 gap-2">
          <F k="mac_payout" label="MAC Payout" />
          <F k="lotto_paid" label="Lotto Paid" />
          <F k="lottery_paid" label="Lottery Paid" />
          <F k="purchase_paid" label="Purchase Paid" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Department Sales</p>
        <div className="grid grid-cols-2 gap-2">
          <F k="dept_tax" label="Tax" />
          <F k="dept_nontax" label="Non Tax" />
          <F k="dept_cig" label="CIG / Tobacco" />
          <F k="dept_beer_wine" label="Beer & Wine" />
          <F k="dept_novelty" label="Novelty" />
          <F k="dept_vape" label="Vape" />
          <F k="dept_unknown_upc" label="Unknown UPC" />
          <F k="lotto_sales" label="Lotto Sales" />
          <F k="lottery_sales" label="Lottery Sales" />
          <F k="money_order_sales" label="Money Order" />
          <F k="money_order_fee" label="M.Order Fee" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Fuel</p>
        <div className="grid grid-cols-2 gap-2">
          <F k="fuel_unleaded_sales" label="Unleaded Sales" />
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Unleaded Gallons</label>
            <input type="number" step="0.001" min="0" value={form.fuel_unleaded_gallons} onChange={e => f('fuel_unleaded_gallons', e.target.value)} className="inp h-9 text-sm" placeholder="0.000" />
          </div>
          <F k="fuel_midgrade_sales" label="Midgrade Sales" />
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Midgrade Gallons</label>
            <input type="number" step="0.001" min="0" value={form.fuel_midgrade_gallons} onChange={e => f('fuel_midgrade_gallons', e.target.value)} className="inp h-9 text-sm" placeholder="0.000" />
          </div>
          <F k="fuel_diesel_sales" label="Diesel Sales" />
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Diesel Gallons</label>
            <input type="number" step="0.001" min="0" value={form.fuel_diesel_gallons} onChange={e => f('fuel_diesel_gallons', e.target.value)} className="inp h-9 text-sm" placeholder="0.000" />
          </div>
        </div>
      </div>
      <div>
        <label className="lbl">Notes</label>
        <input value={form.notes} onChange={e => f('notes', e.target.value)} className="inp" placeholder="Optional" />
      </div>
      <button type="submit" disabled={saving} className="btn btn-accent btn-full py-4">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Check className="h-4 w-4" />Submit Close Till</>}
      </button>
    </form>
  );
}

// ─── Daily Close Report Card ─────────────────────────────────────────────────
function CloseReportCard({ report, tillCount }: { report: any; tillCount: number }) {
  const n = (v: any) => Number(v || 0);
  const shortOver = n(report.short_over);
  const isShort = shortOver < 0;

  const Row = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={cn('num text-sm font-semibold', accent ? 'text-accent' : 'text-gray-900')}>{fmt.currency(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-gray-900 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Daily Close Report</p>
            <p className="text-white font-black text-lg mt-1">{format(new Date(report.report_date + 'T12:00:00'), 'MMMM d, yyyy')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{tillCount} till close{tillCount !== 1 ? 's' : ''} submitted</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total Sales</p>
            <p className="num text-3xl font-black text-white mt-1">{fmt.currency(report.total_sales)}</p>
          </div>
        </div>
      </div>

      {/* SHORT / OVER — most important number */}
      <div className={cn('rounded-2xl p-5 border-2', shortOver === 0 ? 'border-gray-200 bg-gray-50' : isShort ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50')}>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">SHORT / OVER</p>
        <div className="flex items-end justify-between">
          <p className={cn('num text-5xl font-black', shortOver === 0 ? 'text-gray-900' : isShort ? 'text-red-600' : 'text-green-700')}>
            {isShort ? '' : shortOver > 0 ? '+' : ''}{fmt.currency(shortOver)}
          </p>
          <div className="text-right space-y-1 mb-1">
            <div><p className="text-xs text-gray-500">Expected</p><p className="num font-bold text-gray-900">{fmt.currency(report.cash_expected)}</p></div>
            <div><p className="text-xs text-gray-500">Actual</p><p className="num font-bold text-gray-900">{fmt.currency(report.cash_actual)}</p></div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {shortOver === 0 ? '✓ Drawer is exact — perfect!' : isShort ? `⚠ Drawer is ${fmt.currency(Math.abs(shortOver))} short — investigate` : `↑ Drawer is ${fmt.currency(shortOver)} over`}
        </p>
      </div>

      {/* Cash Flow */}
      <div className="tile p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Cash Flow</p>
        <Row label="ATM (MAC)" value={n(report.atm_total)} />
        <Row label="Checks" value={n(report.checks_total)} />
        <Row label="Cash in Drawer" value={n(report.cash_in_drawer)} />
        <Row label="Net Cash" value={n(report.net_cash)} />
        <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-accent">
          <span className="font-black text-gray-900">TOTAL CASH FLOW</span>
          <span className="num font-black text-accent text-xl">{fmt.currency(report.total_cash_flow)}</span>
        </div>
      </div>

      {/* Department + T.Sales side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="tile p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Departments</p>
          <Row label="Tax" value={n(report.dept_tax)} />
          <Row label="Non Tax" value={n(report.dept_nontax)} />
          <Row label="CIG" value={n(report.dept_cig)} />
          <Row label="Beer & Wine" value={n(report.dept_beer_wine)} />
          <Row label="Novelty" value={n(report.dept_novelty)} />
          <Row label="Vape" value={n(report.dept_vape)} />
          <Row label="Unknown UPC" value={n(report.dept_unknown_upc)} />
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
        </div>
      </div>

      {/* T.Cash Flow */}
      <div className="tile p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">T.Cash Flow (Payment Methods)</p>
        <Row label="T.Cash Flow" value={n(report.total_cash_flow)} />
        <Row label="Credit Card" value={n(report.credit_card_total)} />
        <Row label="EBT" value={n(report.ebt_total)} />
        <Row label="Checks" value={n(report.check_total)} />
        <Row label="Coupons" value={n(report.coupon_total)} />
        <Row label="MAC Payout" value={n(report.mac_payout)} accent />
        <Row label="Purchase Paid" value={n(report.purchase_paid)} accent />
        <Row label="Lotto Paid" value={n(report.lotto_paid)} accent />
        <Row label="Lottery Paid" value={n(report.lottery_paid)} accent />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: 'Total In', v: report.total_in, cls: 'bg-green-50 text-green-700' },
          { l: 'Total Out', v: report.total_out, cls: 'bg-red-50 text-red-700' },
          { l: 'Gross', v: report.gross, cls: 'bg-gray-50 text-gray-900' },
          { l: 'Net', v: report.net, cls: 'bg-accent text-white' },
        ].map(k => (
          <div key={k.l} className={cn('rounded-xl p-3 text-center', k.cls)}>
            <p className="text-xs font-medium opacity-70">{k.l}</p>
            <p className="num font-black text-base mt-0.5">{fmt.currency(Number(k.v || 0))}</p>
          </div>
        ))}
      </div>

      {/* Deposit */}
      <div className="rounded-2xl bg-accent p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-red-200 mb-3">Deposit</p>
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex justify-between gap-8"><span className="text-red-200 text-sm">MAC Deposit</span><span className="num font-bold text-white">{fmt.currency(report.mac_deposit ?? 0)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-red-200 text-sm">Store Deposit</span><span className="num font-bold text-white">{fmt.currency(report.store_deposit ?? 0)}</span></div>
          </div>
          <div className="text-right">
            <p className="text-red-200 text-xs">TOTAL DEPOSIT</p>
            <p className="num text-3xl font-black text-white">{fmt.currency(report.total_deposit ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* ATG Fuel Reading */}
      {(n(report.atg_unleaded) + n(report.atg_midgrade) + n(report.atg_diesel)) > 0 && (
        <div className="tile p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Daily ATG Reading</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'Unleaded', v: report.atg_unleaded },
              { l: 'Midgrade', v: report.atg_midgrade },
              { l: 'Premium', v: report.atg_premium },
              { l: 'Diesel', v: report.atg_diesel },
            ].map(f => (
              <div key={f.l} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 font-medium">{f.l}</p>
                <p className="num font-black text-gray-900 mt-1">{Number(f.v || 0).toFixed(1)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── POS Register ────────────────────────────────────────────────────────────
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
      sb.from('employees').select('id,name').eq('store_id', store.id).eq('is_active', true),
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

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku ?? '').includes(q) || (p.barcode ?? '').includes(q);
  });
  const add = (p: any) => setCart(c => { const ex = c.find(i => i.product.id === p.id); return ex ? c.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i) : [...c, { product: p, qty: 1 }]; });
  const chg = (id: string, d: number) => setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));

  const tr = store?.tax_rate ?? 0.0825;
  let sub = 0, tax = 0;
  for (const i of cart) { const l = Number(i.product.unit_price) * i.qty; sub += l; if (i.product.taxable) tax += l * tr; }
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
      for (const i of cart) await sb.from('products').update({ quantity: Math.max(0, i.product.quantity - i.qty), last_sold_at: new Date().toISOString() }).eq('id', i.product.id);
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
          {done.cart.map((i: any) => <div key={i.product.id} className="flex justify-between text-xs"><span className="text-sub">{i.qty}× {i.product.name}</span><span className="num">{fmt.currency(i.product.unit_price * i.qty)}</span></div>)}
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
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold text-text">Staff PIN</h2><button onClick={() => { setShowPin(false); setPinInput(''); }}><X className="h-5 w-5 text-muted" /></button></div>
            <div className="text-center mb-4 text-3xl font-mono tracking-widest min-h-10">{pinInput ? '•'.repeat(pinInput.length) : <span className="text-dim text-lg">Enter PIN</span>}</div>
            {pinErr && <p className="text-center text-sm text-accent mb-3">{pinErr}</p>}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => (
                <button key={String(k)} onClick={() => { if (k === '⌫') setPinInput(p => p.slice(0,-1)); else if (k !== '') setPinInput(p => p+k); }}
                  className={cn('h-13 rounded-xl text-lg font-bold active:scale-95 transition-transform', k === '' ? 'opacity-0' : 'bg-surface text-text hover:bg-border')}>{k}</button>
              ))}
            </div>
            <button onClick={pinLogin} disabled={pinInput.length < 4} className="btn btn-accent btn-full">Login</button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" /><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scan barcode…" className="inp pl-11" autoFocus /></div>
        <button onClick={() => setShowPin(true)} className={cn('flex items-center gap-1.5 rounded-xl border px-3 text-sm font-medium shrink-0', employee ? 'border-green-300 bg-green-50 text-green-700' : 'border-border bg-surface text-sub')}>
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
            <span className="chip chip-gray">{cart.reduce((s,i)=>s+i.qty,0)} items</span>
          </div>
          <div className="divide-y divide-border/60">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-text truncate">{item.product.name}</p><p className="num text-xs text-muted">{fmt.currency(item.product.unit_price)}</p></div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => chg(item.product.id,-1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-sub hover:text-text active:scale-95"><Minus className="h-3.5 w-3.5"/></button>
                  <span className="num w-6 text-center font-black text-text">{item.qty}</span>
                  <button onClick={() => chg(item.product.id,1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-sub hover:text-text active:scale-95"><Plus className="h-3.5 w-3.5"/></button>
                  <button onClick={() => setCart(c=>c.filter(i=>i.product.id!==item.product.id))} className="flex h-8 w-8 items-center justify-center rounded-lg text-dim hover:text-accent hover:bg-red-50 active:scale-95 ml-1"><Trash2 className="h-3.5 w-3.5"/></button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-sub"><span>Subtotal</span><span className="num">{fmt.currency(sub)}</span></div>
              <div className="flex justify-between text-sub"><span>Tax ({((tr)*100).toFixed(2)}%)</span><span className="num">{fmt.currency(tax)}</span></div>
              <div className="flex justify-between font-black text-text border-t border-border pt-1.5"><span>Total</span><span className="num text-accent text-lg">{fmt.currency(total)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{id:'cash',l:'Cash',i:DollarSign},{id:'credit',l:'Credit',i:CreditCard},{id:'debit',l:'Debit',i:CreditCard},{id:'mobile',l:'Mobile',i:Smartphone}].map(pm=>{
                const Icon=pm.i;
                return <button key={pm.id} onClick={()=>setPayment(pm.id)} className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold',payment===pm.id?'border-accent bg-red-50 text-accent':'border-border text-sub hover:text-text')}><Icon className="h-4 w-4"/>{pm.l}</button>;
              })}
            </div>
            <button onClick={complete} disabled={saving} className="btn btn-accent btn-full py-4 text-base">
              {saving?'Processing…':<><Check className="h-5 w-5"/>Complete · {fmt.currency(total)}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function DailySalesPage() {
  const { store } = useStore();
  const [view, setView] = useState<View>('report');
  const [report, setReport] = useState<any>(null);
  const [tillCount, setTillCount] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todayTxns, setTodayTxns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const today = new Date().toISOString().split('T')[0];
    const todayStart = startOfDay(new Date()).toISOString();
    const [{ data: rpt }, { data: tills }, { data: sales }, { data: emps }] = await Promise.all([
      sb.from('daily_close_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
      sb.from('till_readings').select('id').eq('store_id', store.id).eq('reading_date', today),
      sb.from('sales').select('total').eq('store_id', store.id).gte('created_at', todayStart),
      sb.from('employees').select('id,name').eq('store_id', store.id).eq('is_active', true),
    ]);
    if (rpt) setReport(rpt);
    setEmployees(emps ?? []);
    setTillCount((tills ?? []).length);
    setTodaySales((sales ?? []).reduce((s: number, r: any) => s + Number(r.total), 0));
    setTodayTxns((sales ?? []).length);
    setLoading(false);
  }, [store]);

  useEffect(() => { loadData(); }, [loadData]);

  // Called when scan/upload succeeds — stays on report tab and shows result
  const handleTillResult = (data: any) => {
    if (data.report) setReport(data.report);
    setTillCount(data.tillCount ?? 1);
    loadData();
    setView('report'); // switch to report tab to show the result
  };

  const TABS = [
    { id: 'report', label: '📊 Today\'s Report' },
    { id: 'pos', label: '🛒 POS Register' },
    { id: 'close_till', label: '📋 Close Till' },
  ];

  return (
    <Screen title="Daily Sales" subtitle={format(new Date(), 'EEEE, MMMM d')}>
      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id as View)}
            className={cn('flex-none rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
              view === t.id ? 'bg-accent text-white shadow-red' : 'bg-surface text-sub border border-border hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Quick stats always visible */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="tile p-4 text-center">
          <p className="text-xs text-muted font-medium">POS Sales</p>
          <p className="num font-black text-xl text-text mt-1">{fmt.currency(todaySales)}</p>
          <p className="text-xs text-dim mt-0.5">{todayTxns} txns</p>
        </div>
        <div className="tile p-4 text-center">
          <p className="text-xs text-muted font-medium">Till Closes</p>
          <p className="num font-black text-xl text-text mt-1">{tillCount}</p>
          <p className="text-xs text-dim mt-0.5">today</p>
        </div>
        <div className={cn('tile p-4 text-center border-2', !report ? 'border-gray-200' : Number(report.short_over) < 0 ? 'border-red-400 bg-red-50' : Number(report.short_over) > 0 ? 'border-green-400 bg-green-50' : 'border-gray-200')}>
          <p className="text-xs text-muted font-medium">Short/Over</p>
          <p className={cn('num font-black text-xl mt-1', !report ? 'text-dim' : Number(report.short_over) < 0 ? 'text-red-700' : Number(report.short_over) > 0 ? 'text-green-700' : 'text-text')}>
            {report ? (Number(report.short_over) > 0 ? '+' : '') + fmt.currency(report.short_over) : '—'}
          </p>
        </div>
      </div>

      {/* ── REPORT TAB ── */}
      {view === 'report' && (
        <div className="space-y-4">
          {loading && <div className="tile p-10 text-center"><Loader2 className="h-8 w-8 text-accent animate-spin mx-auto" /></div>}
          {!loading && !report && (
            <div className="tile p-10 text-center border-2 border-dashed border-gray-200">
              <Clock className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="font-bold text-gray-700 text-lg mb-2">No close report yet</p>
              <p className="text-gray-400 text-sm mb-5">Go to Close Till tab and upload or scan your till sheet. The report will appear here automatically.</p>
              <button onClick={() => setView('close_till')} className="btn btn-accent px-8 py-3">
                Submit Close Till →
              </button>
            </div>
          )}
          {report && <CloseReportCard report={report} tillCount={tillCount} />}
        </div>
      )}

      {/* ── POS TAB ── */}
      {view === 'pos' && store && <POSRegister store={store} />}

      {/* ── CLOSE TILL TAB ── */}
            {view === 'close_till' && (
        <div className="space-y-5">
          <div className="tile p-5 border-l-4 border-l-accent">
            <p className="font-bold text-text text-lg mb-1">Submit Close Till</p>
            <p className="text-sm text-muted">Take photos of all your till sheet pages. AI reads every number instantly and builds the daily close report.</p>
          </div>
          <div className="tile p-5">
            {employees.length > 0 && (
              <div className="mb-4">
                <label className="lbl">Who is closing?</label>
                <select value={selectedEmp} onChange={(e:any) => setSelectedEmp(e.target.value)} className="inp">
                  <option value="">— Optional —</option>
                  {employees.map((e:any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            <MultiScan
              endpoint="/api/scan-till"
              onResult={handleTillResult}
              title="📸 Photograph Your Till Sheet"
              hint="Take photo of each page → all pages show as thumbnails → hit Submit to AI"
              extraFields={selectedEmp ? { employee_id: selectedEmp, employee_name: employees.find((e:any) => e.id === selectedEmp)?.name ?? 'Unknown' } : {}}
            />
          </div>
          <div className="tile p-5">
            <p className="font-semibold text-text mb-4">✏️ Enter Manually Instead</p>
            <ManualEntry onDone={handleTillResult} />
          </div>
        </div>
      )}
    </Screen>
  );
}
