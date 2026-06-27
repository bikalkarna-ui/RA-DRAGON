'use client';
import { useEffect, useState, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { createClient } from '@/lib/supabase/client';
import { fmt, cn } from '@/lib/utils';
import { FileText, Check, X, AlertTriangle, Loader2, Trash2, ChevronRight, RotateCcw } from 'lucide-react';
import { MultiScan } from '@/components/ui/multi-scan';
import { format } from 'date-fns';

export default function InvoicesPage() {
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
    const { data } = await createClient()
      .from('invoices').select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false }).limit(50);
    setInvoices(data ?? []);
    setLoading(false);
  }, [store]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Called right after a successful scan — auto-opens review
  const handleScan = (data: any) => {
    setConfirmResult(null);
    setConfirmError(null);
    openReview(data.invoice, data.items);
    fetchInvoices();
  };

  // Load invoice items from DB and open review panel
  const openReview = async (inv: any, preloadedItems?: any[]) => {
    setReviewId(inv.id);
    setReviewMeta(inv);
    setConfirmResult(null);
    setConfirmError(null);

    if (preloadedItems) {
      // Items passed directly from scan result
      setItems(preloadedItems.map((li: any) => ({
        ...li,
        _name: li.matched_name ?? li.raw_description ?? '',
        _unitPrice: String(li.suggested_price ?? li.current_price ?? li.unit_cost ?? ''),
        _action: li.is_new_product ? 'create' : 'update',
      })));
    } else {
      // Load from DB (when tapping "Needs review" in history)
      setLoadingItems(true);
      const { data } = await createClient()
        .from('invoice_items').select('*')
        .eq('invoice_id', inv.id).order('raw_description');
      setItems((data ?? []).map((li: any) => ({
        ...li,
        _name: li.matched_name ?? li.raw_description ?? '',
        _unitPrice: String(li.suggested_price ?? li.old_price ?? li.unit_cost ?? ''),
        _action: li.action === 'create' ? 'create' : 'update',
      })));
      setLoadingItems(false);
    }

    // Scroll to review panel
    setTimeout(() => {
      document.getElementById('review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const closeReview = () => {
    setReviewId(null);
    setReviewMeta(null);
    setItems([]);
    setConfirmResult(null);
    setConfirmError(null);
  };

  const upd = (id: string, patch: any) =>
    setItems(p => p.map(it => it.id === id ? { ...it, ...patch } : it));

  const confirm = async () => {
    if (!reviewId) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch('/api/confirm-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: reviewId,
          items: items.map(li => ({
            id: li.id,
            action: li._action,
            product_id: li.product_id ?? null,
            name: li._name || li.raw_description,
            sku: li.sku ?? '',
            barcode: li.barcode ?? '',
            vendor_company: reviewMeta?.vendor_company ?? null,
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
    } finally {
      setConfirming(false);
    }
  };

  const deleteInvoice = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // don't open review when deleting
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    setDeleting(invoiceId);
    try {
      // Delete items first, then invoice
      await createClient().from('invoice_items').delete().eq('invoice_id', invoiceId);
      await createClient().from('invoices').delete().eq('id', invoiceId);
      if (reviewId === invoiceId) closeReview();
      fetchInvoices();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const priceChanges = items.filter(i => i.price_changed && i._action !== 'skip');
  const included = items.filter(i => i._action !== 'skip');

  const STATUS_CHIP: Record<string, string> = {
    NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
    COMPLETED:    'bg-green-100 text-green-700',
    FAILED:       'bg-red-100 text-red-700',
    PROCESSING:   'bg-gray-100 text-gray-600',
  };
  const STATUS_LABEL: Record<string, string> = {
    NEEDS_REVIEW: 'Needs Review',
    COMPLETED:    'Completed',
    FAILED:       'Failed',
    PROCESSING:   'Processing',
  };

  return (
    <Screen title="Invoices" subtitle="Upload, track, and archive all vendor invoices">
      <div className="space-y-5">

        {/* Success banner */}
        {confirmResult && (
          <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4">
            <p className="font-bold text-green-800 text-base">
              ✓ Invoice applied to inventory!
            </p>
            <p className="text-sm text-green-700 mt-1">
              {confirmResult.created} new products created · {confirmResult.updated} products updated
            </p>
            <button onClick={closeReview} className="mt-2 text-sm text-green-700 font-semibold underline">
              Done
            </button>
          </div>
        )}

        {/* Scanner */}
        <MultiScan
          endpoint="/api/scan-invoice"
          onResult={handleScan}
          title="📸 Scan or Upload Invoice"
          hint="Take photos of all pages — AI reads every product, price, and quantity"
        />

        {/* ── REVIEW PANEL ── */}
        {reviewId && reviewMeta && (
          <div id="review-panel" className="tile overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-amber-50">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-black text-text text-lg">{reviewMeta.vendor_name ?? 'Invoice'}</p>
                  {!confirmResult && <span className="chip bg-amber-100 text-amber-700">Needs Review</span>}
                  {confirmResult && <span className="chip bg-green-100 text-green-700">✓ Applied</span>}
                </div>
                <p className="text-sm text-muted">
                  {reviewMeta.vendor_company && `${reviewMeta.vendor_company} · `}
                  {reviewMeta.total_amount && `${fmt.currency(reviewMeta.total_amount)} · `}
                  {items.length} line items
                </p>
              </div>
              <button onClick={closeReview} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-border text-muted hover:text-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Price change alert */}
            {priceChanges.length > 0 && (
              <div className="mx-5 mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">{priceChanges.length} price change{priceChanges.length > 1 ? 's' : ''} detected</p>
                </div>
                {priceChanges.map(li => (
                  <p key={li.id} className="text-xs text-amber-700">
                    {li.matched_name ?? li.raw_description}: {fmt.currency(li.old_cost ?? 0)} → <span className="font-bold">{fmt.currency(li.unit_cost)}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Loading */}
            {loadingItems && (
              <div className="flex items-center gap-3 p-8 justify-center">
                <Loader2 className="h-6 w-6 text-accent animate-spin" />
                <p className="text-muted">Loading items…</p>
              </div>
            )}

            {/* Items list */}
            {!loadingItems && (
              <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
                {items.map(li => (
                  <div key={li.id} className={cn(
                    'rounded-2xl border p-4 transition-all',
                    li._action === 'skip'
                      ? 'border-gray-100 bg-gray-50 opacity-50'
                      : li.price_changed
                      ? 'border-amber-200 bg-amber-50'
                      : li.is_new_product
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-white',
                  )}>
                    {/* Product name + badges */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={cn('chip text-[10px] font-bold', li.is_new_product ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>
                            {li.is_new_product ? '+ New product' : '↻ Update existing'}
                          </span>
                          {li.price_changed && (
                            <span className="chip bg-amber-100 text-amber-700 text-[10px] font-bold">
                              ⚠ Price changed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted mb-1">From invoice: "{li.raw_description}"</p>
                        <input
                          value={li._name}
                          onChange={e => upd(li.id, { _name: e.target.value })}
                          disabled={li._action === 'skip'}
                          className="inp h-9 text-sm font-semibold"
                          placeholder="Product name"
                        />
                      </div>
                    </div>

                    {/* Cost / Price / Qty row */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <label className="text-[10px] text-muted font-semibold uppercase tracking-wide block mb-1">Cost $</label>
                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 num">
                          {fmt.currency(li.unit_cost)}
                        </div>
                        {li.old_cost && li.price_changed && (
                          <p className="text-[10px] text-amber-600 mt-0.5">was {fmt.currency(li.old_cost)}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] text-muted font-semibold uppercase tracking-wide block mb-1">Sell Price $</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={li._unitPrice}
                          onChange={e => upd(li.id, { _unitPrice: e.target.value })}
                          disabled={li._action === 'skip'}
                          className="inp h-9 text-sm num"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted font-semibold uppercase tracking-wide block mb-1">Qty</label>
                        <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-bold text-gray-900 num text-center">
                          {li.quantity}
                        </div>
                      </div>
                    </div>

                    {/* Include / Skip toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => upd(li.id, { _action: li.is_new_product ? 'create' : 'update' })}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors',
                          li._action !== 'skip' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                        <Check className="h-3.5 w-3.5" />
                        {li.is_new_product ? 'Add to inventory' : 'Update product'}
                      </button>
                      <button
                        onClick={() => upd(li.id, { _action: 'skip' })}
                        className={cn('flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-colors',
                          li._action === 'skip' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                        <X className="h-3.5 w-3.5" />
                        Skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm error */}
            {confirmError && (
              <div className="mx-5 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-accent font-medium">{confirmError}</p>
              </div>
            )}

            {/* Apply button */}
            {!confirmResult && !loadingItems && (
              <div className="p-5 border-t border-border">
                <button onClick={confirm} disabled={confirming || included.length === 0}
                  className="btn btn-accent btn-full py-4 text-base">
                  {confirming
                    ? <><Loader2 className="h-5 w-5 animate-spin" />Updating inventory…</>
                    : <><Check className="h-5 w-5" />Apply {included.length} item{included.length !== 1 ? 's' : ''} to inventory</>
                  }
                </button>
                <p className="text-xs text-muted text-center mt-2">
                  This will add/update products in your inventory
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── INVOICE HISTORY ── */}
        <div>
          <p className="section-title">Invoice History</p>
          {loading && <div className="tile p-8 text-center"><Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" /></div>}
          {!loading && invoices.length === 0 && (
            <div className="tile p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-dim mb-3" />
              <p className="text-muted text-sm">No invoices yet. Scan your first one above.</p>
            </div>
          )}
          {!loading && invoices.length > 0 && (
            <div className="tile overflow-hidden divide-y divide-border">
              {invoices.map(inv => {
                const isReviewing = reviewId === inv.id;
                const needsReview = inv.status === 'NEEDS_REVIEW';
                return (
                  <div key={inv.id}
                    className={cn('transition-colors', needsReview ? 'cursor-pointer hover:bg-amber-50' : 'hover:bg-surface cursor-pointer', isReviewing && 'bg-amber-50')}
                    onClick={() => openReview(inv)}>
                    <div className="flex items-center gap-3 px-5 py-4">
                      {/* Icon */}
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', needsReview ? 'bg-amber-100' : 'bg-pink-50')}>
                        <FileText className={cn('h-5 w-5', needsReview ? 'text-amber-600' : 'text-pink-400')} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-text truncate">
                            {inv.vendor_name ?? 'Unknown vendor'}
                          </p>
                          {inv.price_changes_count > 0 && (
                            <span className="chip bg-amber-100 text-amber-700 text-[10px]">
                              ⚠ {inv.price_changes_count} price changes
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {inv.vendor_company ? `${inv.vendor_company} · ` : ''}
                          {format(new Date(inv.created_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-2 shrink-0">
                        {inv.total_amount && (
                          <span className="num text-sm font-bold text-text">{fmt.currency(inv.total_amount)}</span>
                        )}
                        <span className={cn('chip text-[10px] font-bold', STATUS_CHIP[inv.status] ?? 'bg-gray-100 text-gray-600')}>
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </span>

                        {/* Review arrow — visible on needs-review */}
                        {needsReview && (
                          <ChevronRight className="h-4 w-4 text-amber-500" />
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteInvoice(inv.id, e)}
                          disabled={deleting === inv.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors ml-1">
                          {deleting === inv.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Needs review banner */}
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
