'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { FileText, Check, X, AlertTriangle, Loader2, Trash2, ChevronRight, RefreshCw, Package, DollarSign, TrendingUp } from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';

function fmtDate(d: any) {
  try { if (!d) return '—'; const dt = new Date(d); if (isNaN(dt.getTime())) return '—'; return dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return '—'; }
}

export default function InvoicesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { store } = useStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewMeta, setReviewMeta] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const { data } = await createClient()
        .from('invoices')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setInvoices(data ?? []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [store]);

  useEffect(() => { if (mounted && store) fetchInvoices(); }, [mounted, store, fetchInvoices]);

  const openReview = async (inv: any) => {
    if (reviewId === inv.id) { closeReview(); return; }
    setReviewId(inv.id);
    setReviewMeta(inv);
    setConfirmResult(null);
    setConfirmError(null);
    setLoadingItems(true);
    try {
      const { data } = await createClient()
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', inv.id)
        .order('id');
      setItems((data ?? []).map((li: any) => ({
        ...li,
        _action: li.action || (li.is_new_product ? 'create' : 'update'),
        _name: li.matched_name || li.raw_description || '',
        _unitPrice: String(li.suggested_price || li.old_price || (li.unit_cost * 1.3).toFixed(2) || ''),
      })));
    } catch (e: any) { setConfirmError('Failed to load items: ' + e.message); }
    setLoadingItems(false);

    // Scroll to review panel
    setTimeout(() => document.getElementById('review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const closeReview = () => {
    setReviewId(null);
    setReviewMeta(null);
    setItems([]);
    setConfirmResult(null);
    setConfirmError(null);
  };

  const upd = (id: string, patch: any) =>
    setItems(prev => prev.map(li => li.id === id ? { ...li, ...patch } : li));

  const handleScan = (data: any) => {
    if (data?.invoice?.id) {
      fetchInvoices();
      // Auto-open the review panel for the new invoice
      setTimeout(() => openReview(data.invoice), 300);
    }
  };

  const applyInvoice = async () => {
    if (!reviewId) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch('/api/confirm-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: reviewId,
          store_id: store?.id,
          items: items.map(li => ({
            id: li.id,
            action: li._action,
            product_id: li.product_id ?? null,
            name: li._name || li.raw_description,
            sku: li.sku ?? '',
            barcode: li.upc ?? '',
            vendor_company: reviewMeta?.vendor_company ?? reviewMeta?.vendor_name ?? null,
            quantity: Number(li.quantity) || 0,
            unit_cost: Number(li.unit_cost) || 0,
            unit_price: parseFloat(li._unitPrice) || Math.round((Number(li.unit_cost) || 0) * 1.3 * 100) / 100,
            raw_description: li.raw_description,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setConfirmError(d.error || 'Failed to apply changes'); return; }
      setConfirmResult(d);
      fetchInvoices();
    } catch (err: any) {
      setConfirmError(err.message);
    } finally { setConfirming(false); }
  };

  const deleteInvoice = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    setDeleting(invoiceId);
    try {
      const sb = createClient();
      await sb.from('invoice_items').delete().eq('invoice_id', invoiceId);
      await sb.from('invoices').delete().eq('id', invoiceId);
      if (reviewId === invoiceId) closeReview();
      fetchInvoices();
    } catch (err: any) { alert('Delete failed: ' + err.message); }
    finally { setDeleting(null); }
  };

  if (!mounted) return null;

  const priceChanges = items.filter(i => i.price_changed && i._action !== 'skip');
  const included = items.filter(i => i._action !== 'skip');
  const newItems = items.filter(i => i.is_new_product && i._action !== 'skip');
  const updateItems = items.filter(i => !i.is_new_product && i._action !== 'skip');

  return (
    <Screen title="Invoices" subtitle="Scan vendor invoices — AI reads every item and updates inventory automatically">
      <div className="space-y-5">

        {/* Scanner */}
        <MultiScan
          endpoint="/api/scan-invoice"
          onResult={handleScan}
          title="Scan or Upload Invoice"
          hint="Photo of vendor invoice — AI reads every product, price, and quantity instantly"
        />

        {/* ── REVIEW PANEL ── */}
        {reviewId && reviewMeta && (
          <div id="review-panel" className="tile overflow-hidden border-2 border-amber-300">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-amber-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-black text-text text-lg">{reviewMeta.vendor_name ?? 'Invoice'}</p>
                  {confirmResult
                    ? <span className="chip chip-green text-xs">✓ Applied to inventory</span>
                    : <span className="chip bg-amber-100 text-amber-700 text-xs">Needs Review</span>
                  }
                </div>
                <p className="text-sm text-muted">
                  {reviewMeta.invoice_number && `#${reviewMeta.invoice_number} · `}
                  {reviewMeta.total_amount && `${fmt.currency(reviewMeta.total_amount)} · `}
                  {fmtDate(reviewMeta.invoice_date || reviewMeta.created_at)} · {items.length} items
                </p>
              </div>
              <button onClick={closeReview} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-border text-muted hover:text-accent ml-3">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Success banner */}
            {confirmResult && (
              <div className="m-5 rounded-xl bg-green-50 border-2 border-green-300 p-4">
                <p className="font-bold text-green-800">✓ Invoice applied to inventory!</p>
                <p className="text-sm text-green-700 mt-1">
                  {confirmResult.created} new products added · {confirmResult.updated} products updated
                </p>
                <button onClick={closeReview} className="mt-2 text-sm text-green-700 font-semibold underline">Done</button>
              </div>
            )}

            {/* Summary stats */}
            {!confirmResult && items.length > 0 && (
              <div className="grid grid-cols-3 gap-3 p-5 border-b border-border">
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="num font-black text-blue-700 text-xl">{newItems.length}</p>
                  <p className="text-xs text-blue-600 font-medium">New Products</p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="num font-black text-green-700 text-xl">{updateItems.length}</p>
                  <p className="text-xs text-green-600 font-medium">Updates</p>
                </div>
                <div className={cn('rounded-xl p-3 text-center', priceChanges.length > 0 ? 'bg-amber-50' : 'bg-gray-50')}>
                  <p className={cn('num font-black text-xl', priceChanges.length > 0 ? 'text-amber-700' : 'text-gray-400')}>{priceChanges.length}</p>
                  <p className={cn('text-xs font-medium', priceChanges.length > 0 ? 'text-amber-600' : 'text-muted')}>Price Changes</p>
                </div>
              </div>
            )}

            {/* Price change alert */}
            {priceChanges.length > 0 && !confirmResult && (
              <div className="mx-5 mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">{priceChanges.length} cost price change{priceChanges.length > 1 ? 's' : ''} detected</p>
                </div>
                {priceChanges.map(li => (
                  <p key={li.id} className="text-xs text-amber-700">
                    {li.matched_name ?? li.raw_description}: {fmt.currency(li.old_cost ?? 0)} → <span className="font-bold">{fmt.currency(li.unit_cost)}</span>
                  </p>
                ))}
              </div>
            )}

            {loadingItems && (
              <div className="flex items-center gap-3 p-10 justify-center">
                <Loader2 className="h-6 w-6 text-accent animate-spin" />
                <p className="text-muted">Loading items…</p>
              </div>
            )}

            {/* Items list */}
            {!loadingItems && !confirmResult && items.length > 0 && (
              <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                {items.map(li => (
                  <div key={li.id} className={cn(
                    'rounded-2xl border p-4 transition-all',
                    li._action === 'skip'    ? 'border-gray-100 bg-gray-50 opacity-50' :
                    li.price_changed         ? 'border-amber-200 bg-amber-50/50' :
                    li.is_new_product        ? 'border-blue-200 bg-blue-50/50' :
                                               'border-gray-200 bg-white'
                  )}>
                    {/* Badges + raw description */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={cn('chip text-[10px] font-bold',
                        li.is_new_product ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>
                        {li.is_new_product ? '+ New product' : '↻ Update existing'}
                      </span>
                      {li.price_changed && <span className="chip bg-amber-100 text-amber-700 text-[10px] font-bold">⚠ Cost changed</span>}
                    </div>
                    <p className="text-[11px] text-muted mb-2">Invoice says: "{li.raw_description}"</p>

                    {/* Name input */}
                    <div className="mb-3">
                      <label className="lbl">Product name</label>
                      <input
                        value={li._name}
                        onChange={e => upd(li.id, { _name: e.target.value })}
                        disabled={li._action === 'skip'}
                        className="inp h-9 text-sm font-semibold"
                        placeholder="Product name"
                      />
                      {li.matched_name && li.matched_name !== li._name && (
                        <p className="text-[10px] text-muted mt-1">Matched to: {li.matched_name}</p>
                      )}
                    </div>

                    {/* Cost / Price / Qty */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <label className="lbl">Cost $</label>
                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-bold num">
                          {fmt.currency(li.unit_cost)}
                        </div>
                        {li.price_changed && li.old_cost > 0 && (
                          <p className="text-[10px] text-amber-600 mt-0.5">was {fmt.currency(li.old_cost)}</p>
                        )}
                      </div>
                      <div>
                        <label className="lbl">Sell Price $</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={li._unitPrice}
                          onChange={e => upd(li.id, { _unitPrice: e.target.value })}
                          disabled={li._action === 'skip'}
                          className="inp h-9 text-sm num"
                          placeholder="0.00"
                        />
                        {li.unit_cost > 0 && li._unitPrice && (
                          <p className="text-[10px] text-green-600 mt-0.5">
                            {Math.round(((parseFloat(li._unitPrice) - li.unit_cost) / parseFloat(li._unitPrice)) * 100)}% margin
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="lbl">Qty Received</label>
                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-bold num text-center">
                          {li.quantity}
                        </div>
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="flex items-center justify-between mb-3 text-xs text-muted">
                      <span>Line total: <span className="num font-bold text-text">{fmt.currency(li.unit_cost * li.quantity)}</span></span>
                      {li.current_price > 0 && <span>Current sell: <span className="num font-bold text-text">{fmt.currency(li.current_price)}</span></span>}
                    </div>

                    {/* Include / Skip */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => upd(li.id, { _action: li.is_new_product ? 'create' : 'update' })}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-colors',
                          li._action !== 'skip' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                        <Check className="h-3.5 w-3.5" />
                        {li.is_new_product ? 'Add to inventory' : 'Update & receive stock'}
                      </button>
                      <button
                        onClick={() => upd(li.id, { _action: 'skip' })}
                        className={cn('flex items-center justify-center gap-1 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors',
                          li._action === 'skip' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                        <X className="h-3.5 w-3.5" />Skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {confirmError && (
              <div className="mx-5 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-accent font-medium">{confirmError}</p>
              </div>
            )}

            {/* Apply button */}
            {!confirmResult && !loadingItems && included.length > 0 && (
              <div className="p-5 border-t border-border bg-gray-50">
                <button onClick={applyInvoice} disabled={confirming}
                  className="btn btn-accent btn-full py-4 text-base gap-2">
                  {confirming
                    ? <><Loader2 className="h-5 w-5 animate-spin" />Updating inventory…</>
                    : <><Check className="h-5 w-5" />Apply {included.length} item{included.length!==1?'s':''} to inventory</>
                  }
                </button>
                <p className="text-xs text-muted text-center mt-2">
                  {newItems.length > 0 && `${newItems.length} new products will be created · `}
                  {updateItems.length > 0 && `${updateItems.length} products will have stock added`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Invoice History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">Invoice History</p>
            <button onClick={fetchInvoices} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted hover:text-sub">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading && <div className="tile p-8 text-center"><Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}

          {!loading && invoices.length === 0 && (
            <div className="tile">
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Scan your first vendor invoice above — AI reads everything automatically."
                color="red"
              />
            </div>
          )}

          {!loading && invoices.length > 0 && (
            <div className="tile overflow-hidden divide-y divide-border">
              {invoices.map(inv => {
                const isReviewing = reviewId === inv.id;
                const needsReview = inv.status === 'NEEDS_REVIEW';
                return (
                  <div key={inv.id}
                    className={cn('cursor-pointer transition-colors', isReviewing ? 'bg-amber-50' : needsReview ? 'hover:bg-amber-50/50' : 'hover:bg-surface')}
                    onClick={() => openReview(inv)}>
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        needsReview ? 'bg-amber-100' : inv.status === 'COMPLETED' ? 'bg-green-50' : 'bg-pink-50')}>
                        <FileText className={cn('h-5 w-5', needsReview ? 'text-amber-600' : inv.status === 'COMPLETED' ? 'text-green-500' : 'text-pink-400')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-bold text-text">{inv.vendor_name ?? 'Unknown vendor'}</p>
                          {inv.price_changes_count > 0 && (
                            <span className="chip bg-amber-100 text-amber-700 text-[10px]">⚠ {inv.price_changes_count} price changes</span>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {inv.invoice_number ? `#${inv.invoice_number} · ` : ''}
                          {fmtDate(inv.invoice_date || inv.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {inv.total_amount > 0 && <span className="num text-sm font-bold text-text">{fmt.currency(inv.total_amount)}</span>}
                        <span className={cn('chip text-[10px] font-bold',
                          inv.status === 'NEEDS_REVIEW' ? 'bg-amber-100 text-amber-700' :
                          inv.status === 'COMPLETED'    ? 'chip-green' : 'chip-gray')}>
                          {inv.status === 'NEEDS_REVIEW' ? 'Review' : inv.status === 'COMPLETED' ? '✓ Done' : inv.status}
                        </span>
                        <button
                          onClick={e => deleteInvoice(inv.id, e)}
                          disabled={deleting === inv.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          {deleting === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {needsReview && !isReviewing && (
                      <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-amber-100 px-4 py-2.5">
                        <p className="text-xs font-semibold text-amber-800">Tap to review and apply to inventory</p>
                        <ChevronRight className="h-4 w-4 text-amber-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
