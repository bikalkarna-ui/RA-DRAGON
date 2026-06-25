'use client';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDOR_COMPANIES } from '@/lib/utils';
import { Search, Plus, Minus, Trash2, Printer, Check, User, CreditCard, DollarSign, Smartphone, X, Flame, Scan } from 'lucide-react';
import { BarcodeScanner } from '@/components/ui/barcode-scanner';
import { format } from 'date-fns';

interface Product { id:string; sku:string|null; barcode:string|null; name:string; unit_price:number; unit_cost:number; quantity:number; taxable:boolean; vendor_company:string|null; }
interface CartItem { product:Product; qty:number; }
interface Employee { id:string; name:string; role:string; }
interface CompletedSale { items:CartItem[]; subtotal:number; tax:number; total:number; date:Date; employee:Employee|null; payment:string; }

const PAYMENTS = [
  { id:'cash', label:'Cash', icon:DollarSign },
  { id:'credit', label:'Credit', icon:CreditCard },
  { id:'debit', label:'Debit', icon:CreditCard },
  { id:'mobile', label:'Mobile', icon:Smartphone },
];

export default function POSPage() {
  const { store } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [employee, setEmployee] = useState<Employee|null>(null);
  const [payment, setPayment] = useState('cash');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale|null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef<NodeJS.Timeout>();

  const fetchData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: prods }, { data: emps }] = await Promise.all([
      sb.from('products').select('id,sku,barcode,name,unit_price,unit_cost,quantity,taxable,vendor_company').eq('store_id', store.id).eq('is_active', true).order('name'),
      sb.from('employees').select('id,name,role').eq('store_id', store.id).eq('is_active', true),
    ]);
    setProducts((prods as Product[]) ?? []);
    setEmployees((emps as Employee[]) ?? []);
  }, [store]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Barcode scanner support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && barcodeBuffer.current.length > 2) {
        const code = barcodeBuffer.current.trim();
        const prod = products.find(p => p.barcode === code || p.sku === code);
        if (prod) addToCart(prod);
        else setSearch(code);
        barcodeBuffer.current = '';
        return;
      }
      if (e.key.length === 1 && document.activeElement !== searchRef.current) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 80);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [products]);

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku??'').includes(q) || (p.barcode??'').includes(q);
  });

  const addToCart = (product: Product) => {
    setCart(c => {
      const ex = c.find(i => i.product.id === product.id);
      if (ex) return c.map(i => i.product.id === product.id ? { ...i, qty: i.qty+1 } : i);
      return [...c, { product, qty:1 }];
    });
    setSearch('');
  };

  const changeQty = (id: string, d: number) =>
    setCart(c => c.map(i => i.product.id===id ? {...i, qty:Math.max(0,i.qty+d)} : i).filter(i=>i.qty>0));

  const totals = useMemo(() => {
    const taxRate = store?.tax_rate ?? 0.0825;
    let subtotal = 0, tax = 0;
    for (const item of cart) {
      const line = Number(item.product.unit_price) * item.qty;
      subtotal += line;
      if (item.product.taxable) tax += line * taxRate;
    }
    return { subtotal, tax: Math.round(tax*100)/100, total: Math.round((subtotal+tax)*100)/100 };
  }, [cart, store]);

  const loginPin = async () => {
    const sb = createClient();
    const { data } = await sb.from('employees').select('*').eq('store_id', store?.id).eq('pin', pinInput).eq('is_active', true).maybeSingle();
    if (data) { setEmployee(data); setPinInput(''); setPinError(''); setShowPin(false); }
    else { setPinError('Wrong PIN'); }
  };

  const completeSale = async () => {
    if (!store || cart.length===0) return;
    setSaving(true); setError(null);
    try {
      const sb = createClient();
      const { data: sale, error: saleErr } = await sb.from('sales').insert({
        store_id:store.id, employee_id:employee?.id??null, employee_name:employee?.name??null,
        subtotal:totals.subtotal, tax:totals.tax, total:totals.total, payment_method:payment,
      }).select('id').single();
      if (saleErr) throw saleErr;

      await sb.from('sale_items').insert(cart.map(item => ({
        sale_id:sale.id, product_id:item.product.id, product_name:item.product.name,
        vendor_company:item.product.vendor_company, sku:item.product.sku,
        quantity:item.qty, unit_price:item.product.unit_price, unit_cost:item.product.unit_cost,
        taxable:item.product.taxable, line_total:Number(item.product.unit_price)*item.qty,
      })));

      for (const item of cart) {
        await sb.from('products').update({ quantity:Math.max(0, item.product.quantity-item.qty), last_sold_at:new Date().toISOString() }).eq('id', item.product.id);
      }

      setCompletedSale({ items:cart, ...totals, date:new Date(), employee, payment });
      setCart([]); fetchData();
    } catch (err:any) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (completedSale) return (
    <AppShell title="Point of Sale" storeName={store?.name}>
      <div className="mx-auto max-w-sm space-y-4">
        <div id="receipt" className="d-card p-6 font-mono text-sm">
          <div className="mb-5 text-center border-b border-dragon-border pb-5">
            <Flame className="mx-auto h-8 w-8 text-fire-500 mb-2" />
            <p className="font-bold text-white text-lg">{store?.name}</p>
            {store?.address && <p className="text-xs text-obsidian-500">{store.address}</p>}
            <p className="text-xs text-obsidian-500 mt-1">{format(completedSale.date, 'MMM d, yyyy · h:mm a')}</p>
            {completedSale.employee && <p className="text-xs text-obsidian-500">Cashier: {completedSale.employee.name}</p>}
          </div>
          <div className="space-y-1.5 pb-4 border-b border-dashed border-dragon-border">
            {completedSale.items.map(item => (
              <div key={item.product.id} className="flex justify-between text-xs">
                <span className="text-obsidian-300">{item.qty}× {item.product.name}</span>
                <span className="text-white">{fmt.currency(Number(item.product.unit_price)*item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="pt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-obsidian-400"><span>Subtotal</span><span>{fmt.currency(completedSale.subtotal)}</span></div>
            <div className="flex justify-between text-obsidian-400"><span>Tax</span><span>{fmt.currency(completedSale.tax)}</span></div>
            <div className="flex justify-between text-base font-bold text-white border-t border-dragon-border pt-2 mt-2">
              <span>TOTAL</span><span className="text-fire-400">{fmt.currency(completedSale.total)}</span>
            </div>
            <div className="flex justify-between text-obsidian-500 text-xs"><span>Payment</span><span className="capitalize">{completedSale.payment}</span></div>
          </div>
          <p className="mt-4 text-center text-xs text-obsidian-600 border-t border-dashed border-dragon-border pt-4">Thank you — RA Solution</p>
        </div>
        <div className="flex gap-3 no-print">
          <button onClick={() => window.print()} className="flex-1 btn-fire py-3">
            <Printer className="h-4 w-4" />Print Receipt
          </button>
          <button onClick={() => setCompletedSale(null)} className="flex-1 btn-ghost py-3">New Sale</button>
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="Live Sales / POS" storeName={store?.name}>
      {/* PIN Modal */}
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="d-card w-80 p-6 shadow-fire">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white">Employee PIN Login</h2>
              <button onClick={() => { setShowPin(false); setPinInput(''); setPinError(''); }} className="text-obsidian-600 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&loginPin()} autoFocus maxLength={8}
              className="d-input text-center text-2xl tracking-widest font-mono mb-3" placeholder="••••" />
            {pinError && <p className="text-sm text-fire-400 text-center mb-3">{pinError}</p>}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => (
                <button key={String(k)} onClick={() => { if (k==='⌫') setPinInput(p=>p.slice(0,-1)); else if (k!=='') setPinInput(p=>p+k); }}
                  className={cn('h-12 rounded-xl text-lg font-bold transition-all', k===''?'opacity-0 pointer-events-none':'bg-obsidian-800 text-white hover:bg-fire-900/60 hover:text-fire-400 active:scale-95 border border-dragon-border')}>
                  {k}
                </button>
              ))}
            </div>
            <button onClick={loginPin} className="btn-fire w-full">Login</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fire-600 animate-pulse" />
              <input ref={searchRef} placeholder="Search or scan barcode — scanner auto-adds to cart…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus
                className="d-input pl-10 h-11 w-full border-fire-900/40" />
            </div>
            <button onClick={() => setShowPin(true)}
              className={cn('flex items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all', employee ? 'border-fire-700 bg-fire-900/30 text-fire-400' : 'border-dragon-border text-obsidian-400 hover:border-fire-800 hover:text-fire-400')}>
              <User className="h-4 w-4" />{employee ? employee.name : 'Staff'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(p => {
              const vc = VENDOR_COMPANIES.find(v => v.name === p.vendor_company);
              return (
                <button key={p.id} onClick={() => addToCart(p)} disabled={p.quantity===0}
                  className="d-card p-4 text-left transition-all hover:border-fire-800/60 hover:shadow-fire-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-98">
                  {vc && <span className="text-xs text-obsidian-500 mb-1 block">{vc.emoji} {vc.name}</span>}
                  <p className="text-sm font-semibold text-white leading-tight">{p.name}</p>
                  {p.sku && <p className="text-xs text-obsidian-600 mt-0.5">{p.sku}</p>}
                  <p className="mono mt-2 text-lg font-bold text-fire-400">{fmt.currency(p.unit_price)}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className={cn('d-badge text-[10px]', p.quantity===0?'bg-fire-900/50 text-fire-400':p.quantity<=5?'bg-gold-900/30 text-gold-400':'bg-obsidian-800 text-obsidian-400')}>
                      {p.quantity===0?'OUT':p.quantity<=5?`${p.quantity} left`:`${p.quantity} in stock`}
                    </span>
                    {p.taxable && <span className="text-[10px] text-obsidian-600">+tax</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length===0 && <p className="col-span-3 py-10 text-center text-sm text-obsidian-500">No products found.</p>}
          </div>
        </div>

        {/* Cart */}
        <div className="flex flex-col">
          <div className="d-card flex flex-col overflow-hidden">
            <div className="border-b border-dragon-border px-4 py-3.5 flex items-center justify-between">
              <h2 className="font-bold text-white">Cart</h2>
              {cart.length > 0 && <span className="d-badge bg-fire-900/40 text-fire-400">{cart.reduce((s,i)=>s+i.qty,0)} items</span>}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-32">
              {cart.length===0 ? (
                <p className="py-8 text-center text-sm text-obsidian-600">Tap a product or scan a barcode</p>
              ) : cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                    <p className="mono text-xs text-obsidian-500">{fmt.currency(item.product.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(item.product.id,-1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-obsidian-800 text-obsidian-400 hover:bg-fire-900/50 hover:text-fire-400 transition-colors"><Minus className="h-3 w-3"/></button>
                    <span className="mono w-7 text-center text-sm font-bold text-white">{item.qty}</span>
                    <button onClick={() => changeQty(item.product.id,1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-obsidian-800 text-obsidian-400 hover:bg-fire-900/50 hover:text-fire-400 transition-colors"><Plus className="h-3 w-3"/></button>
                    <button onClick={() => setCart(c=>c.filter(i=>i.product.id!==item.product.id))} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-obsidian-600 hover:bg-fire-950/50 hover:text-fire-500 transition-colors"><Trash2 className="h-3.5 w-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-dragon-border p-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-obsidian-400"><span>Subtotal</span><span className="mono">{fmt.currency(totals.subtotal)}</span></div>
                  <div className="flex justify-between text-obsidian-400"><span>Tax ({((store?.tax_rate??0.0825)*100).toFixed(2)}%)</span><span className="mono">{fmt.currency(totals.tax)}</span></div>
                  <div className="flex justify-between text-base font-bold text-white border-t border-dragon-border pt-1.5 mt-1.5">
                    <span>Total</span><span className="mono text-fire-400">{fmt.currency(totals.total)}</span>
                  </div>
                </div>

                {/* Payment */}
                <div className="grid grid-cols-2 gap-1.5">
                  {PAYMENTS.map(pm => {
                    const Icon = pm.icon;
                    return (
                      <button key={pm.id} onClick={() => setPayment(pm.id)}
                        className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all', payment===pm.id?'border-fire-700 bg-fire-900/30 text-fire-400':'border-dragon-border text-obsidian-500 hover:border-fire-900/50')}>
                        <Icon className="h-3.5 w-3.5"/>{pm.label}
                      </button>
                    );
                  })}
                </div>

                {error && <p className="text-xs text-fire-400">{error}</p>}

                <button onClick={completeSale} disabled={saving}
                  className="w-full btn-fire py-3.5 text-sm font-bold shadow-fire">
                  {saving ? 'Processing…' : <><Check className="h-4 w-4"/>Complete · {fmt.currency(totals.total)}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
