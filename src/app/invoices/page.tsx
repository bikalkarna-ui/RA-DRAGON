'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn, VENDOR_COMPANIES } from '@/lib/utils';
import { Upload, Loader2, Check, X, Sparkles, FileText, AlertTriangle } from 'lucide-react';
import { BarcodeScanner, ScanToast } from '@/components/ui/barcode-scanner';
import { format } from 'date-fns';

interface Invoice { id:string; vendor_name:string|null; vendor_company:string|null; invoice_number:string|null; total_amount:number|null; status:string; price_changes_count:number; created_at:string; }
interface ReviewItem { id:string; raw_description:string; quantity:number; unit_cost:number; old_cost:number|null; line_total:number; suggested_price:number|null; old_price:number|null; price_changed:boolean; is_new_product:boolean; product_id:string|null; match_confidence:number|null; matched_name?:string|null; current_price?:number|null; current_quantity?:number|null; _name:string; _sku:string; _barcode:string; _vendor_company:string; _unitPrice:string; _action:'create'|'update'|'skip'; }

const STATUS: Record<string,{label:string;cls:string}> = {
  NEEDS_REVIEW: { label:'Needs Review', cls:'bg-gold-900/30 text-gold-400' },
  COMPLETED: { label:'Completed', cls:'bg-obsidian-800 text-obsidian-300' },
  FAILED: { label:'Failed', cls:'bg-fire-900/30 text-fire-400' },
  PROCESSING: { label:'Processing', cls:'bg-obsidian-700 text-obsidian-400' },
};

export default function InvoicesPage() {
  const { store } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [reviewId, setReviewId] = useState<string|null>(null);
  const [reviewMeta, setReviewMeta] = useState<any>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanResult, setScanResult] = useState<{barcode:string;product:any}|null>(null);
  const [scanMatchedInvoice, setScanMatchedInvoice] = useState<string|null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('invoices').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);
    setInvoices((data as Invoice[]) ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/scan-invoice', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setReviewId(data.invoice.id); setReviewMeta(data.invoice);
      setItems(data.items.map((li: any) => ({
        ...li, _name: li.matched_name ?? li.raw_description,
        _sku: '', _barcode: '', _vendor_company: li.vendor_company ?? '',
        _unitPrice: String(li.suggested_price ?? li.current_price ?? ''),
        _action: li.is_new_product ? 'create' : 'update',
      })));
      fetchInvoices();
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const upd = (id: string, patch: Partial<ReviewItem>) => setItems(p => p.map(it => it.id === id ? { ...it, ...patch } : it));

  const confirm = async () => {
    if (!reviewId) return;
    setConfirming(true); setError(null);
    try {
      const res = await fetch('/api/confirm-invoice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: reviewId, items: items.map(li => ({ id:li.id, action:li._action, product_id:li.product_id, name:li._name, sku:li._sku, barcode:li._barcode, vendor_company:li._vendor_company||null, quantity:li.quantity, unit_cost:li.unit_cost, unit_price:parseFloat(li._unitPrice)||0, price_changed:li.price_changed })) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data); setReviewId(null); setItems([]); setReviewMeta(null);
      fetchInvoices();
    } catch (err: any) { setError(err.message); }
    finally { setConfirming(false); }
  };

  const priceChangeItems = items.filter(i => i.price_changed && i._action !== 'skip');

  return (
    <AppShell title="AI Invoice Scanner" storeName={store?.name}>
      <div className="space-y-5">
        {scanResult && (
          <ScanToast barcode={scanResult.barcode} product={scanResult.product} onClose={() => setScanResult(null)} />
        )}
        {/* Barcode scanner — scan a product to see if it appears on any recent invoice */}
        {!reviewId && store && (
          <div className="d-card p-4 border-fire-900/30 flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-white shrink-0">Scan product to find in invoices</p>
            <BarcodeScanner
              storeId={store.id}
              onScan={r => {
                setScanResult(r);
                if (r.product) setScanMatchedInvoice(`Scanned: ${r.product.name} · Cost: $${Number(r.product.unit_cost).toFixed(2)} · Last invoice price on file`);
                else setScanMatchedInvoice(`Barcode ${r.barcode} not found in inventory`);
              }}
              placeholder="Scan product barcode…"
              className="flex-1 min-w-48"
            />
            {scanMatchedInvoice && (
              <div className="w-full rounded-lg bg-obsidian-900/60 border border-dragon-border px-3 py-2 flex items-center justify-between">
                <p className="text-sm text-obsidian-300">{scanMatchedInvoice}</p>
                <button onClick={() => setScanMatchedInvoice(null)} className="text-obsidian-600 hover:text-obsidian-300 ml-2">✕</button>
              </div>
            )}
          </div>
        )}
        {result && (
          <div className="d-card p-4 border-fire-900/50 bg-fire-950/20">
            <div className="flex items-center gap-2 mb-1"><Check className="h-4 w-4 text-fire-500" /><p className="font-semibold text-white">Invoice processed!</p></div>
            <p className="text-sm text-obsidian-400">{result.created} new products created · {result.updated} updated · {result.priceChanges} price changes applied</p>
          </div>
        )}

        {!reviewId && (
          <div className="d-card p-8 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-fire-900/30 border border-fire-800/30">
              <Sparkles className="h-8 w-8 text-fire-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">AI Invoice Scanner</h2>
            <p className="text-sm text-obsidian-400 mb-6 max-w-md mx-auto">Upload any vendor invoice — PDF or photo. AI reads it, matches products, detects price changes, and updates your inventory.</p>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-fire text-base px-6 py-3">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'AI reading invoice…' : 'Upload invoice PDF or photo'}
            </button>
            {error && <p className="mt-3 text-sm text-fire-400">{error}</p>}
          </div>
        )}

        {reviewId && reviewMeta && (
          <div className="d-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-fire-500" />
                <h3 className="font-bold text-white">Review Extraction</h3>
                {reviewMeta.vendor_company && (
                  <span className="text-base">{VENDOR_COMPANIES.find(v => v.name === reviewMeta.vendor_company)?.emoji}</span>
                )}
              </div>
              <div className="text-right text-sm">
                <p className="text-white font-medium">{reviewMeta.vendor_name ?? 'Unknown vendor'} {reviewMeta.vendor_company ? `(${reviewMeta.vendor_company})` : ''}</p>
                {reviewMeta.total_amount && <p className="text-fire-400 mono">{fmt.currency(reviewMeta.total_amount)}</p>}
              </div>
            </div>

            {priceChangeItems.length > 0 && (
              <div className="mb-4 rounded-xl border border-gold-800/50 bg-gold-950/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-gold-400" />
                  <p className="font-semibold text-gold-400">Price Changes Detected ({priceChangeItems.length} items)</p>
                </div>
                <div className="space-y-1">
                  {priceChangeItems.map(li => (
                    <p key={li.id} className="text-xs text-obsidian-300">
                      <span className="font-medium text-white">{li.matched_name ?? li.raw_description}</span>: cost was {fmt.currency(li.old_cost ?? 0)} → now {fmt.currency(li.unit_cost)}
                      {li.old_price && <span className="text-obsidian-500"> · old price was {fmt.currency(li.old_price)}</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {items.map(li => (
                <div key={li.id} className={cn('rounded-xl border p-3.5 transition-all', li._action === 'skip' ? 'border-dragon-border opacity-40' : li.price_changed ? 'border-gold-800/50 bg-gold-950/20' : 'border-dragon-border')}>
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                    <div>
                      <p className="text-xs text-obsidian-500">"{li.raw_description}"</p>
                      <p className="text-sm text-obsidian-300 mt-0.5">Qty: {li.quantity} · Cost: {fmt.currency(li.unit_cost)} {li.price_changed && li.old_cost ? `(was ${fmt.currency(li.old_cost)})` : ''}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {li.price_changed && <span className="d-badge bg-gold-900/40 text-gold-400 text-[10px]">⚠ Price Changed</span>}
                      {li.is_new_product ? <span className="d-badge bg-fire-900/30 text-fire-400 text-[10px]">New product</span> : <span className="d-badge bg-obsidian-700 text-obsidian-300 text-[10px]">Matched {li.match_confidence ? `${Math.round(li.match_confidence * 100)}%` : ''}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2"><label className="d-label">Product name</label><input value={li._name} onChange={e => upd(li.id, { _name: e.target.value })} disabled={li._action === 'skip'} className="d-input h-8 text-xs" /></div>
                    <div><label className="d-label">Retail price</label>
                      <input type="number" step="0.01" value={li._unitPrice} onChange={e => upd(li.id, { _unitPrice: e.target.value })} disabled={li._action === 'skip'} className="d-input h-8 text-xs mono" />
                      {li.suggested_price && <p className="text-[10px] text-fire-500 mt-0.5">AI: {fmt.currency(li.suggested_price)} (30% markup)</p>}
                    </div>
                    {li.is_new_product && <div><label className="d-label">Vendor</label>
                      <select value={li._vendor_company} onChange={e => upd(li.id, { _vendor_company: e.target.value })} disabled={li._action === 'skip'} className="d-select h-8 text-xs">
                        <option value="">— select —</option>
                        {VENDOR_COMPANIES.filter(v => v.id !== 'custom').map(v => <option key={v.id} value={v.name}>{v.emoji} {v.name}</option>)}
                      </select>
                    </div>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => upd(li.id, { _action: li.is_new_product ? 'create' : 'update' })} className={cn('d-badge text-xs py-1 px-2.5 cursor-pointer', li._action !== 'skip' ? 'bg-fire-700 text-white' : 'bg-obsidian-800 text-obsidian-400 hover:bg-obsidian-700')}><Check className="h-3 w-3 inline mr-1" />Include</button>
                    <button onClick={() => upd(li.id, { _action: 'skip' })} className={cn('d-badge text-xs py-1 px-2.5 cursor-pointer', li._action === 'skip' ? 'bg-fire-900/50 text-fire-400' : 'bg-obsidian-800 text-obsidian-400 hover:bg-fire-950/50 hover:text-fire-500')}><X className="h-3 w-3 inline mr-1" />Skip</button>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-fire-400">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={confirm} disabled={confirming} className="btn-fire">
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {confirming ? 'Updating inventory…' : `Confirm & apply (${items.filter(i => i._action !== 'skip').length} items)`}
              </button>
              <button onClick={() => { setReviewId(null); setItems([]); setReviewMeta(null); }} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        <div className="d-card overflow-hidden">
          <div className="border-b border-dragon-border px-5 py-3.5"><h3 className="font-semibold text-white">Invoice History</h3></div>
          <div className="divide-y divide-dragon-border">
            {loading && <p className="px-5 py-8 text-center text-obsidian-500">Loading…</p>}
            {!loading && invoices.length === 0 && <p className="px-5 py-8 text-center text-obsidian-500">No invoices yet.</p>}
            {invoices.map(inv => {
              const s = STATUS[inv.status] ?? STATUS.PROCESSING;
              const vc = VENDOR_COMPANIES.find(v => v.name === inv.vendor_company);
              return (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-obsidian-900/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{vc?.emoji ?? '📄'}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{inv.vendor_name ?? 'Unknown vendor'}{inv.vendor_company ? ` · ${inv.vendor_company}` : ''}</p>
                      <p className="text-xs text-obsidian-500">{inv.invoice_number ? `#${inv.invoice_number} · ` : ''}{format(new Date(inv.created_at), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {inv.price_changes_count > 0 && <span className="d-badge bg-gold-900/30 text-gold-400 text-[10px]">⚠ {inv.price_changes_count} price changes</span>}
                    {inv.total_amount && <span className="mono text-sm font-bold text-fire-400">{fmt.currency(inv.total_amount)}</span>}
                    <span className={cn('d-badge text-xs', s.cls)}>{s.label}</span>
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
