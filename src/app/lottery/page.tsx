'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { Ticket, Fuel, Check } from 'lucide-react';
import { format } from 'date-fns';
import { BarcodeScanner, ScanToast } from '@/components/ui/barcode-scanner';

interface LotteryEntry { id:string; entry_date:string; scratch_sales:number; scratch_payouts:number; scratch_net:number; lotto_sales:number; lotto_payouts:number; lotto_net:number; total_net:number; books_activated:number; books_settled:number; notes:string|null; }
interface FuelEntry { id:string; entry_date:string; regular_gallons:number; regular_price:number; plus_gallons:number; plus_price:number; premium_gallons:number; premium_price:number; diesel_gallons:number; diesel_price:number; total_gallons:number; total_fuel_sales:number; notes:string|null; }

const ZERO_L = { scratch_sales:'', scratch_payouts:'', lotto_sales:'', lotto_payouts:'', books_activated:'', books_settled:'', notes:'' };
const ZERO_F = { regular_gallons:'', regular_price:'', plus_gallons:'', plus_price:'', premium_gallons:'', premium_price:'', diesel_gallons:'', diesel_price:'', notes:'' };

export default function LotteryFuelPage() {
  const { store } = useStore();
  const [tab, setTab] = useState<'lottery'|'fuel'>('lottery');
  const [lotteryEntries, setLotteryEntries] = useState<LotteryEntry[]>([]);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lForm, setLForm] = useState(ZERO_L);
  const [fForm, setFForm] = useState(ZERO_F);
  const [lDate, setLDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fDate, setFDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanResult, setScanResult] = useState<{barcode:string;product:any}|null>(null);
  const [scanInfo, setScanInfo] = useState<string|null>(null);

  const fetchData = useCallback(async () => {
    if (!store) return;
    const sb = createClient();
    const [{ data: lot }, { data: fuel }] = await Promise.all([
      sb.from('lottery_entries').select('*').eq('store_id', store.id).order('entry_date', { ascending: false }).limit(30),
      sb.from('fuel_entries').select('*').eq('store_id', store.id).order('entry_date', { ascending: false }).limit(30),
    ]);
    setLotteryEntries((lot as LotteryEntry[]) ?? []);
    setFuelEntries((fuel as FuelEntry[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleScan = (result: {barcode:string;product:any}) => {
    setScanResult(result);
    if (result.product) {
      // If it's a lottery ticket or fuel-related product, show relevant info
      const name = result.product.name.toLowerCase();
      if (name.includes('lottery') || name.includes('scratch') || name.includes('lotto') || name.includes('ticket')) {
        setScanInfo(`🎟 Lottery product scanned: ${result.product.name} — log sales manually below`);
        setTab('lottery');
      } else if (name.includes('fuel') || name.includes('gas') || name.includes('diesel') || name.includes('unleaded')) {
        setScanInfo(`⛽ Fuel product scanned: ${result.product.name} — log gallons manually below`);
        setTab('fuel');
      } else {
        setScanInfo(`📦 ${result.product.name} — Stock: ${result.product.quantity} · Price: ${fmt.currency(result.product.unit_price)}`);
      }
    } else {
      setScanInfo(`Barcode ${result.barcode} not found in inventory`);
    }
  };

  const lf = (k:string,v:string) => setLForm(p=>({...p,[k]:v}));
  const ff = (k:string,v:string) => setFForm(p=>({...p,[k]:v}));
  const num = (v:string) => parseFloat(v)||0;
  const int = (v:string) => parseInt(v,10)||0;

  const previewNet = (num(lForm.scratch_sales)+num(lForm.lotto_sales))-(num(lForm.scratch_payouts)+num(lForm.lotto_payouts));

  const saveLottery = async (e:React.FormEvent) => {
    e.preventDefault(); if (!store) return; setSaving(true);
    await createClient().from('lottery_entries').upsert({
      store_id:store.id, entry_date:lDate,
      scratch_sales:num(lForm.scratch_sales), scratch_payouts:num(lForm.scratch_payouts),
      lotto_sales:num(lForm.lotto_sales), lotto_payouts:num(lForm.lotto_payouts),
      books_activated:int(lForm.books_activated), books_settled:int(lForm.books_settled),
      notes:lForm.notes||null,
    },{ onConflict:'store_id,entry_date' });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
    setLForm(ZERO_L); fetchData();
  };

  const saveFuel = async (e:React.FormEvent) => {
    e.preventDefault(); if (!store) return; setSaving(true);
    await createClient().from('fuel_entries').upsert({
      store_id:store.id, entry_date:fDate,
      regular_gallons:num(fForm.regular_gallons), regular_price:num(fForm.regular_price),
      plus_gallons:num(fForm.plus_gallons), plus_price:num(fForm.plus_price),
      premium_gallons:num(fForm.premium_gallons), premium_price:num(fForm.premium_price),
      diesel_gallons:num(fForm.diesel_gallons), diesel_price:num(fForm.diesel_price),
      notes:fForm.notes||null,
    },{ onConflict:'store_id,entry_date' });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
    setFForm(ZERO_F); fetchData();
  };

  const lotTotals = {
    scratchSales:lotteryEntries.reduce((s,e)=>s+Number(e.scratch_sales),0),
    scratchPayouts:lotteryEntries.reduce((s,e)=>s+Number(e.scratch_payouts),0),
    lottoSales:lotteryEntries.reduce((s,e)=>s+Number(e.lotto_sales),0),
    lottoPayouts:lotteryEntries.reduce((s,e)=>s+Number(e.lotto_payouts),0),
    totalNet:lotteryEntries.reduce((s,e)=>s+Number(e.total_net),0),
  };
  const fuelTotals = {
    gallons:fuelEntries.reduce((s,e)=>s+Number(e.total_gallons),0),
    sales:fuelEntries.reduce((s,e)=>s+Number(e.total_fuel_sales),0),
  };

  return (
    <AppShell title="Lottery & Fuel" storeName={store?.name}>
      <div className="space-y-5">
        {scanResult && (
          <ScanToast barcode={scanResult.barcode} product={scanResult.product} onClose={()=>{setScanResult(null);setScanInfo(null);}} />
        )}

        {/* Scanner */}
        <div className="d-card p-4 border-fire-900/30">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-white">Scan lottery ticket or fuel product</p>
            {store && (
              <BarcodeScanner storeId={store.id} onScan={handleScan} placeholder="Scan lottery book or product…" className="flex-1 min-w-48" />
            )}
          </div>
          {scanInfo && (
            <div className="mt-3 rounded-lg bg-obsidian-900/60 border border-dragon-border px-3 py-2">
              <p className="text-sm text-obsidian-300">{scanInfo}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={()=>setTab('lottery')} className={cn('flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all',tab==='lottery'?'bg-fire-700 text-white shadow-fire-sm':'border border-dragon-border text-obsidian-400 hover:border-fire-800 hover:text-fire-400')}>
            <Ticket className="h-4 w-4"/>Lottery
          </button>
          <button onClick={()=>setTab('fuel')} className={cn('flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all',tab==='fuel'?'bg-fire-700 text-white shadow-fire-sm':'border border-dragon-border text-obsidian-400 hover:border-fire-800 hover:text-fire-400')}>
            <Fuel className="h-4 w-4"/>Fuel
          </button>
        </div>

        {tab==='lottery' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {label:'Scratch Sales',value:fmt.currency(lotTotals.scratchSales),positive:true},
                {label:'Scratch Payouts',value:fmt.currency(lotTotals.scratchPayouts),positive:false},
                {label:'Lotto Sales',value:fmt.currency(lotTotals.lottoSales),positive:true},
                {label:'Lotto Payouts',value:fmt.currency(lotTotals.lottoPayouts),positive:false},
                {label:'Net (30 days)',value:fmt.currency(lotTotals.totalNet),positive:lotTotals.totalNet>=0,highlight:true},
              ].map(k=>(
                <div key={k.label} className={cn('d-card p-4',k.highlight&&'border-fire-900/50 shadow-fire-sm')}>
                  <p className="text-xs text-obsidian-500 mb-1">{k.label}</p>
                  <p className={cn('mono text-lg font-bold',k.positive?'text-white':'text-fire-400')}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="d-card p-5">
              <h3 className="font-semibold text-white mb-4">Daily Lottery Entry</h3>
              <form onSubmit={saveLottery} className="space-y-4">
                <div><label className="d-label">Date</label><input type="date" value={lDate} onChange={e=>setLDate(e.target.value)} className="d-input w-48"/></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {k:'scratch_sales',label:'🎟 Scratch-Off Sales',pos:true},
                    {k:'scratch_payouts',label:'🎟 Scratch-Off Payouts',pos:false},
                    {k:'lotto_sales',label:'🎰 Lotto Terminal Sales',pos:true},
                    {k:'lotto_payouts',label:'🎰 Lotto Payouts',pos:false},
                  ].map(field=>(
                    <div key={field.k}>
                      <label className={cn('d-label',!field.pos&&'text-fire-400')}>{field.label}</label>
                      <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-obsidian-500">$</span>
                        <input type="number" step="0.01" min="0" value={(lForm as any)[field.k]} onChange={e=>lf(field.k,e.target.value)} className="d-input pl-7" placeholder="0.00"/>
                      </div>
                    </div>
                  ))}
                  <div><label className="d-label">Books Activated</label><input type="number" min="0" value={lForm.books_activated} onChange={e=>lf('books_activated',e.target.value)} className="d-input" placeholder="0"/></div>
                  <div><label className="d-label">Books Settled</label><input type="number" min="0" value={lForm.books_settled} onChange={e=>lf('books_settled',e.target.value)} className="d-input" placeholder="0"/></div>
                  <div className="sm:col-span-2"><label className="d-label">Notes</label><input value={lForm.notes} onChange={e=>lf('notes',e.target.value)} className="d-input" placeholder="Optional"/></div>
                </div>
                {(num(lForm.scratch_sales)+num(lForm.lotto_sales))>0&&(
                  <div className={cn('flex items-center justify-between rounded-xl px-4 py-3 border',previewNet>=0?'bg-fire-950/30 border-fire-900/50':'bg-fire-950/50 border-fire-800/50')}>
                    <span className="font-semibold text-white">Net Lottery (this entry)</span>
                    <span className={cn('mono text-xl font-bold',previewNet>=0?'text-gold-400':'text-fire-400')}>{fmt.currency(previewNet)}</span>
                  </div>
                )}
                <button type="submit" disabled={saving} className="btn-fire">
                  {saved?<><Check className="h-4 w-4"/>Saved!</>:saving?'Saving…':<><Check className="h-4 w-4"/>Save Lottery Entry</>}
                </button>
              </form>
            </div>

            <div className="d-card overflow-hidden">
              <div className="border-b border-dragon-border px-5 py-3.5"><h3 className="font-semibold text-white">Lottery History</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-obsidian-900/50">
                    <tr>{['Date','Scratch Sales','Scratch Paid','Lotto Sales','Lotto Paid','Books Act.','Books Set.','NET'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-obsidian-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-dragon-border">
                    {lotteryEntries.map(e=>(
                      <tr key={e.id} className="hover:bg-obsidian-900/20">
                        <td className="px-3 py-2.5 font-medium text-white">{format(new Date(e.entry_date+'T12:00:00'),'MMM d, yyyy')}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.currency(e.scratch_sales)}</td>
                        <td className="mono px-3 py-2.5 text-fire-400">−{fmt.currency(e.scratch_payouts)}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.currency(e.lotto_sales)}</td>
                        <td className="mono px-3 py-2.5 text-fire-400">−{fmt.currency(e.lotto_payouts)}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-400">{e.books_activated}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-400">{e.books_settled}</td>
                        <td className={cn('mono px-3 py-2.5 font-bold',Number(e.total_net)>=0?'text-gold-400':'text-fire-400')}>{fmt.currency(e.total_net)}</td>
                      </tr>
                    ))}
                    {!loading&&lotteryEntries.length===0&&<tr><td colSpan={8} className="px-3 py-8 text-center text-obsidian-500">No entries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab==='fuel' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="d-card p-4"><p className="text-xs text-obsidian-500 mb-1">Total Gallons (30d)</p><p className="mono text-xl font-bold text-white">{fmt.number(fuelTotals.gallons,1)} gal</p></div>
              <div className="d-card p-4 border-fire-900/50"><p className="text-xs text-obsidian-500 mb-1">Fuel Revenue (30d)</p><p className="mono text-xl font-bold text-fire-400">{fmt.currency(fuelTotals.sales)}</p></div>
            </div>

            <div className="d-card p-5">
              <h3 className="font-semibold text-white mb-4">Daily Fuel Entry</h3>
              <form onSubmit={saveFuel} className="space-y-4">
                <div><label className="d-label">Date</label><input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className="d-input w-48"/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {grade:'Regular',gKey:'regular_gallons',pKey:'regular_price'},
                    {grade:'Plus',gKey:'plus_gallons',pKey:'plus_price'},
                    {grade:'Premium',gKey:'premium_gallons',pKey:'premium_price'},
                    {grade:'Diesel',gKey:'diesel_gallons',pKey:'diesel_price'},
                  ].map(fuel=>(
                    <div key={fuel.grade} className="d-card p-3">
                      <p className="text-sm font-medium text-white mb-2">{fuel.grade}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="d-label">Gallons sold</label><input type="number" step="0.01" min="0" value={(fForm as any)[fuel.gKey]} onChange={e=>ff(fuel.gKey,e.target.value)} className="d-input" placeholder="0.00"/></div>
                        <div><label className="d-label">Price/gallon $</label><input type="number" step="0.001" min="0" value={(fForm as any)[fuel.pKey]} onChange={e=>ff(fuel.pKey,e.target.value)} className="d-input" placeholder="0.000"/></div>
                      </div>
                      {num((fForm as any)[fuel.gKey])>0&&<p className="mt-1.5 text-xs text-fire-400 mono">= {fmt.currency(num((fForm as any)[fuel.gKey])*num((fForm as any)[fuel.pKey]))}</p>}
                    </div>
                  ))}
                </div>
                <div><label className="d-label">Notes</label><input value={fForm.notes} onChange={e=>ff('notes',e.target.value)} className="d-input" placeholder="Optional"/></div>
                <button type="submit" disabled={saving} className="btn-fire">
                  {saved?<><Check className="h-4 w-4"/>Saved!</>:saving?'Saving…':<><Check className="h-4 w-4"/>Save Fuel Entry</>}
                </button>
              </form>
            </div>

            <div className="d-card overflow-hidden">
              <div className="border-b border-dragon-border px-5 py-3.5"><h3 className="font-semibold text-white">Fuel History</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-obsidian-900/50">
                    <tr>{['Date','Regular','Plus','Premium','Diesel','Total Gal','Total Sales'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-obsidian-500">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-dragon-border">
                    {fuelEntries.map(e=>(
                      <tr key={e.id} className="hover:bg-obsidian-900/20">
                        <td className="px-3 py-2.5 font-medium text-white">{format(new Date(e.entry_date+'T12:00:00'),'MMM d, yyyy')}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.number(e.regular_gallons,1)} @ ${Number(e.regular_price).toFixed(3)}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.number(e.plus_gallons,1)} @ ${Number(e.plus_price).toFixed(3)}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.number(e.premium_gallons,1)} @ ${Number(e.premium_price).toFixed(3)}</td>
                        <td className="mono px-3 py-2.5 text-obsidian-300">{fmt.number(e.diesel_gallons,1)} @ ${Number(e.diesel_price).toFixed(3)}</td>
                        <td className="mono px-3 py-2.5 text-white">{fmt.number(e.total_gallons,1)}</td>
                        <td className="mono px-3 py-2.5 font-bold text-fire-400">{fmt.currency(e.total_fuel_sales)}</td>
                      </tr>
                    ))}
                    {!loading&&fuelEntries.length===0&&<tr><td colSpan={7} className="px-3 py-8 text-center text-obsidian-500">No fuel entries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
