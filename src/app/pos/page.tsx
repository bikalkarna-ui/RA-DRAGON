'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Search, Plus, Minus, Trash2, Check, User, CreditCard, DollarSign, Smartphone, X, Printer, TrendingUp } from 'lucide-react';
import { format, startOfDay } from 'date-fns';

interface Product { id: string; name: string; unit_price: number; unit_cost: number; quantity: number; taxable: boolean; vendor_company: string | null; sku: string | null; barcode: string | null; }
interface CartItem { product: Product; qty: number; }
interface Employee { id: string; name: string; role: string; }

export default function POSPage() {
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payment, setPayment] = useState('cash');
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const buf = useRef(''); const timer = useRef<NodeJS.Timeout>();

  const load = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: p }, { data: e }, { data: s }] = await Promise.all([
      sb.from('products').select('id,name,unit_price,unit_cost,quantity,taxable,vendor_company,sku,barcode').eq('store_id', store.id).eq('is_active', true).order('name'),
      sb.from('employees').select('id,name,role').eq('store_id', store.id).eq('is_active', true),
      sb.from('sales').select('total').eq('store_id', store.id).gte('created_at', startOfDay(new Date()).toISOString()),
    ]);
    setProducts((p as Product[]) ?? []);
    setEmployees((e as Employee[]) ?? []);
    setTodayTotal((s ?? []).reduce((acc, r) => acc + Number(r.total), 0));
  }, [store]);

  useEffect(() => { load(); }, [load]);

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

  const add = (p: Product) => setCart(c => {
    const ex = c.find(i => i.product.id === p.id);
    if (ex) return c.map(i => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
    return [...c, { product: p, qty: 1 }];
  });
  const chg = (id: string, d: number) => setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + d) } : i).filter(i => i.qty > 0));

  const totals = useMemo(() => {
    const tr = store?.tax_rate ?? 0.0825;
    let sub = 0, tax = 0;
    for (const i of cart) { const l = Number(i.product.unit_price) * i.qty; sub += l; if (i.product.taxable) tax += l * tr; }
    return { sub, tax: Math.round(tax * 100) / 100, total: Math.round((sub + tax) * 100) / 100 };
  }, [cart, store]);

  const pinLogin = async () => {
    const { data } = await createClient().from('employees').select('*').eq('store_id', store?.id).eq('pin', pinInput).eq('is_active', true).maybeSingle();
    if (data) { setEmployee(data); setPinInput(''); setPinErr(''); setShowPin(false); }
    else setPinErr('Wrong PIN — try again');
  };

  const complete = async () => {
    if (!store || cart.length === 0) return; setSaving(true);
    const sb = createClient();
    const { data: sale } = await sb.from('sales').insert({ store_id: store.id, employee_id: employee?.id ?? null, employee_name: employee?.name ?? null, subtotal: totals.sub, tax: totals.tax, total: totals.total, payment_method: payment, source: 'pos' }).select('id').single();
    if (sale) {
      await sb.from('sale_items').insert(cart.map(i => ({ sale_id: sale.id, product_id: i.product.id, product_name: i.product.name, vendor_company: i.product.vendor_company, sku: i.product.sku, quantity: i.qty, unit_price: i.product.unit_price, unit_cost: i.product.unit_cost, taxable: i.product.taxable, line_total: Number(i.product.unit_price) * i.qty })));
      for (const i of cart) await sb.from('products').update({ quantity: Math.max(0, i.product.quantity - i.qty) }).eq('id', i.product.id);
    }
    setDone({ cart, ...totals, date: new Date(), employee, payment });
    setCart([]); load(); setSaving(false);
  };

  if (done) return (
    <Screen title="Receipt" subtitle={format(done.date, 'MMM d, yyyy · h:mm a')}>
      <div id="receipt" className="tile p-6 mb-5 font-mono text-sm">
        <div className="border-b border-border pb-4 mb-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-8 w-8 bg-accent rounded-xl flex items-center justify-center text-white font-bold">R</div>
            <p className="font-bold text-text">{store?.name}</p>
          </div>
          {done.employee && <p className="text-muted text-xs">Cashier: {done.employee.name}</p>}
        </div>
        <div className="space-y-2 pb-4 border-b border-dashed border-border">
          {done.cart.map((i: any) => <div key={i.product.id} className="flex justify-between text-xs"><span className="text-sub">{i.qty}× {i.product.name}</span><span className="text-text num">{fmt.currency(i.product.unit_price * i.qty)}</span></div>)}
        </div>
        <div className="pt-4 space-y-2 text-xs">
          <div className="flex justify-between text-sub"><span>Subtotal</span><span className="num">{fmt.currency(done.sub)}</span></div>
          <div className="flex justify-between text-sub"><span>Tax</span><span className="num">{fmt.currency(done.tax)}</span></div>
          <div className="flex justify-between text-text font-bold text-base border-t border-border pt-2 mt-1"><span>TOTAL</span><span className="num text-accent">{fmt.currency(done.total)}</span></div>
          <div className="flex justify-between text-dim text-xs capitalize mt-1"><span>Payment</span><span>{done.payment}</span></div>
        </div>
        <p className="mt-5 text-center text-xs text-dim border-t border-dashed border-border pt-4">Thank you!</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => window.print()} className="btn btn-ghost flex-1 gap-2 no-print"><Printer className="h-4 w-4" />Print</button>
        <button onClick={() => setDone(null)} className="btn btn-accent flex-1">New Sale</button>
      </div>
    </Screen>
  );

  return (
    <Screen title="Live Sales" subtitle={`Today: ${fmt.currency(todayTotal)}`}>
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5">
          <div className="tile w-full max-w-xs p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-5"><h2 className="font-bold text-text">Staff PIN Login</h2><button onClick={() => { setShowPin(false); setPinInput(''); }} className="text-muted hover:text-sub"><X className="h-5 w-5" /></button></div>
            <div className="text-center mb-4 text-3xl font-mono tracking-widest text-text">{pinInput.length > 0 ? '•'.repeat(pinInput.length) : <span className="text-dim">Enter PIN</span>}</div>
            {pinErr && <p className="text-center text-sm text-accent mb-3">{pinErr}</p>}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => (
                <button key={String(k)} onClick={() => { if (k === '⌫') setPinInput(p => p.slice(0, -1)); else if (k !== '') setPinInput(p => p + k); }}
                  className={cn('h-14 rounded-2xl text-lg font-semibold transition-all active:scale-95', k === '' ? 'opacity-0 pointer-events-none' : 'bg-card text-text hover:bg-border')}>
                  {k}
                </button>
              ))}
            </div>
            <button onClick={pinLogin} disabled={pinInput.length < 4} className="btn btn-accent btn-full">Login</button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or scan barcode…" className="inp pl-11" autoFocus />
          </div>
          <button onClick={() => setShowPin(true)} className={cn('flex items-center gap-2 rounded-xl px-4 border text-sm font-medium transition-colors', employee ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-border bg-card text-sub hover:text-text')}>
            <User className="h-4 w-4" /><span className="hidden sm:inline">{employee ? employee.name : 'Staff'}</span>
          </button>
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(p => (
            <button key={p.id} onClick={() => add(p)} disabled={p.quantity === 0}
              className="tile p-4 text-left active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
              {p.vendor_company && <p className="text-xs text-muted mb-1">{p.vendor_company}</p>}
              <p className="text-sm font-semibold text-text leading-snug">{p.name}</p>
              <p className="num text-lg font-bold text-accent mt-2">{fmt.currency(p.unit_price)}</p>
              <p className={cn('text-[10px] mt-1', p.quantity === 0 ? 'text-accent' : p.quantity <= 5 ? 'text-amber-400' : 'text-dim')}>{p.quantity === 0 ? 'Out of stock' : `${p.quantity} in stock`}</p>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-2 py-10 text-center text-muted text-sm">No products found.</p>}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="tile overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <p className="font-semibold text-text">Cart</p>
              <span className="chip-gray">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
            </div>
            <div className="divide-y divide-border/60">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-text truncate">{item.product.name}</p><p className="num text-xs text-muted">{fmt.currency(item.product.unit_price)}</p></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => chg(item.product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-card text-sub hover:text-text active:scale-95"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="num w-6 text-center font-bold text-text">{item.qty}</span>
                    <button onClick={() => chg(item.product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-card text-sub hover:text-text active:scale-95"><Plus className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setCart(c => c.filter(i => i.product.id !== item.product.id))} className="flex h-8 w-8 items-center justify-center rounded-xl text-dim hover:text-accent hover:bg-accent/10 active:scale-95"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-sub"><span>Subtotal</span><span className="num">{fmt.currency(totals.sub)}</span></div>
                <div className="flex justify-between text-sub"><span>Tax</span><span className="num">{fmt.currency(totals.tax)}</span></div>
                <div className="flex justify-between font-bold text-text border-t border-border pt-1.5"><span>Total</span><span className="num text-accent text-lg">{fmt.currency(totals.total)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'cash', l: 'Cash', i: DollarSign }, { id: 'credit', l: 'Credit', i: CreditCard }, { id: 'debit', l: 'Debit', i: CreditCard }, { id: 'mobile', l: 'Mobile', i: Smartphone }].map(pm => {
                  const Icon = pm.i; return (
                    <button key={pm.id} onClick={() => setPayment(pm.id)} className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors', payment === pm.id ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-sub hover:text-text')}>
                      <Icon className="h-4 w-4" />{pm.l}
                    </button>
                  );
                })}
              </div>
              <button onClick={complete} disabled={saving} className="btn btn-accent btn-full py-4 text-base">
                {saving ? 'Processing…' : <><Check className="h-5 w-5" />Complete · {fmt.currency(totals.total)}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
