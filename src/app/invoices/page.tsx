'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { AIUpload } from '@/components/ui/ai-upload';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { FileText, Check, X, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function InvoicesPage() {
  const { store } = useStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewMeta, setReviewMeta] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchInvoices = useCallback(async () => {
    if (!store) return;
    const { data } = await createClient().from('invoices').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);
    setInvoices(data ?? []); setLoading(false);
  }, [store]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleScan = (data: any) => {
    setResult(null);
    setReviewId(data.invoice.id); setReviewMeta(data.invoice);
    setItems(data.items.map((li: any) => ({ ...li, _name: li.matched_name ?? li.raw_description, _unitPrice: String(li.suggested_price ?? li.current_price ?? ''), _action: li.is_new_product ? 'create' : 'update' })));
    fetchInvoices();
  };

  const upd = (id: string, patch: any) => setItems(p => p.map(it => it.id === id ? { ...it, ...patch } : it));

  const confirm = async () => {
    if (!reviewId) return; setConfirming(true);
    const res = await fetch('/api/confirm-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: reviewId, items: items.map(li => ({ id: li.id, action: li._action, product_id: li.product_id, name: li._name, sku: '', barcode: '', vendor_company: reviewMeta?.vendor_company || null, quantity: li.quantity, unit_cost: li.unit_cost, unit_price: parseFloat(li._unitPrice) || 0 })) }) });
    const d = await res.json();
    setResult(d); setReviewId(null); setItems([]); setReviewMeta(null);
    fetchInvoices(); setConfirming(false);
  };

  const priceChanges = items.filter(i => i.price_changed && i._action !== 'skip');

  const STATUS: Record<string, string> = { NEEDS_REVIEW: 'chip-yellow', COMPLETED: 'chip-green', FAILED: 'chip-red', PROCESSING: 'chip-gray' };
  const STATUS_L: Record<string, string> = { NEEDS_REVIEW: 'Needs review', COMPLETED: 'Completed', FAILED: 'Failed', PROCESSING: 'Processing' };

  return (
    <Screen title="Invoices" subtitle="Upload, track, and archive all vendor invoices">
      <div className="space-y-5">
        {result && (
          <div className="tile p-4 border border-green-500/30 bg-green-500/5">
            <p className="text-green-400 font-semibold text-sm">✓ Done — {result.created} created · {result.updated} updated</p>
          </div>
        )}

        {/* Upload */}
        <AIUpload label="Upload Vendor Invoice" description="PDF or photo — AI extracts every line item automatically" endpoint="/api/scan-invoice" onResult={handleScan} />

        {/* Review panel */}
        {reviewId && reviewMeta && (
          <div className="tile p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div><p className="font-semibold text-text">{reviewMeta.vendor_name ?? 'Invoice'}</p><p className="text-xs text-muted mt-0.5">{reviewMeta.vendor_company}{reviewMeta.total_amount ? ` · ${fmt.currency(reviewMeta.total_amount)}` : ''}</p></div>
              <span className="chip-yellow">Review</span>
            </div>

            {priceChanges.length > 0 && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 mb-4">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><p className="text-sm font-semibold text-amber-400">{priceChanges.length} price changes</p></div>
                {priceChanges.map(li => <p key={li.id} className="text-xs text-amber-300/70">{li.matched_name ?? li.raw_description}: {fmt.currency(li.old_cost ?? 0)} → {fmt.currency(li.unit_cost)}</p>)}
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {items.map(li => (
                <div key={li.id} className={cn('rounded-xl border p-3 transition-opacity', li._action === 'skip' ? 'border-border opacity-40' : li.price_changed ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card/60')}>
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1"><p className="text-xs text-muted">"{li.raw_description}"</p><input value={li._name} onChange={e => upd(li.id, { _name: e.target.value })} disabled={li._action === 'skip'} className="inp mt-1 h-8 text-xs" /></div>
                    <div className="w-24 shrink-0"><label className="lbl text-[10px]">Price $</label><input type="number" step="0.01" value={li._unitPrice} onChange={e => upd(li.id, { _unitPrice: e.target.value })} disabled={li._action === 'skip'} className="inp h-8 text-xs mono" /></div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={li.is_new_product ? 'chip-blue' : 'chip-green'}>{li.is_new_product ? 'New' : 'Match'}</span>
                    <span className="text-muted">Qty: {li.quantity} · Cost: {fmt.currency(li.unit_cost)}</span>
                    <div className="flex gap-1 ml-auto">
                      <button onClick={() => upd(li.id, { _action: li.is_new_product ? 'create' : 'update' })} className={cn('rounded-lg px-2 py-1 text-[10px] font-semibold', li._action !== 'skip' ? 'bg-accent text-white' : 'bg-card text-muted')}><Check className="h-3 w-3" /></button>
                      <button onClick={() => upd(li.id, { _action: 'skip' })} className={cn('rounded-lg px-2 py-1 text-[10px] font-semibold', li._action === 'skip' ? 'bg-accent/20 text-accent' : 'bg-card text-muted')}><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={confirm} disabled={confirming} className="btn btn-accent flex-1">
                {confirming ? <><Loader2 className="h-4 w-4 animate-spin" />Updating…</> : <><Check className="h-4 w-4" />Apply {items.filter(i => i._action !== 'skip').length} changes</>}
              </button>
              <button onClick={() => { setReviewId(null); setItems([]); }} className="btn btn-ghost"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {/* Invoice history */}
        <div>
          <p className="section-title">Invoice History</p>
          <div className="tile overflow-hidden divide-y divide-border/60">
            {loading && <p className="py-8 text-center text-muted text-sm">Loading…</p>}
            {!loading && invoices.length === 0 && <p className="py-8 text-center text-muted text-sm">No invoices yet.</p>}
            {invoices.map(inv => (
              <div key={inv.id} className="list-row">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10"><FileText className="h-5 w-5 text-pink-400" /></div>
                  <div>
                    <p className="text-sm font-semibold text-text">{inv.vendor_name ?? 'Unknown vendor'}</p>
                    <p className="text-xs text-muted">{inv.vendor_company ? `${inv.vendor_company} · ` : ''}{format(new Date(inv.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {inv.price_changes_count > 0 && <span className="chip-yellow">⚠ {inv.price_changes_count}</span>}
                  {inv.total_amount && <span className="num text-sm font-semibold text-text">{fmt.currency(inv.total_amount)}</span>}
                  <span className={STATUS[inv.status] ?? 'chip-gray'}>{STATUS_L[inv.status] ?? inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}
