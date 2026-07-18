'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { Screen } from '@/components/layout/screen';
import { useStore } from '@/hooks/use-store';
import { fmt, cn } from '@/lib/utils';
import { Plus, Trash2, Download, Send, X, FileText, Check, Loader2 } from 'lucide-react';

type LineItem = { description: string; quantity: string; unit_price: string };

const EMPTY_ITEM: LineItem = { description: '', quantity: '1', unit_price: '' };

export default function BillingPage() {
  const [mounted, setMounted] = useState(false);
  const { store } = useStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [formErr, setFormErr] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/create${store ? `?store_id=${store.id}` : ''}`);
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (mounted) loadInvoices(); }, [mounted, loadInvoices]);

  const updateItem = (i: number, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  };
  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  const total = subtotal + taxAmount;

  const resetForm = () => {
    setCustomerName(''); setCustomerEmail(''); setCustomerAddress(''); setDueDate('');
    setNotes(''); setTaxRate('0'); setItems([{ ...EMPTY_ITEM }]); setFormErr('');
  };

  const createInvoice = async () => {
    setFormErr('');
    if (!customerName.trim()) { setFormErr('Customer name is required'); return; }
    const validItems = items.filter(it => it.description.trim() && it.unit_price);
    if (validItems.length === 0) { setFormErr('Add at least one line item with a description and price'); return; }

    setCreating(true);
    try {
      const res = await fetch('/api/invoices/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName, customer_email: customerEmail, customer_address: customerAddress,
          due_date: dueDate || null, notes, tax_rate: taxRate, store_id: store?.id,
          items: validItems.map(it => ({ description: it.description, quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormErr(data.error || 'Could not create invoice'); setCreating(false); return; }
      setShowForm(false);
      resetForm();
      loadInvoices();
    } catch {
      setFormErr('Network error — please try again');
    }
    setCreating(false);
  };

  const sendInvoice = async (id: string) => {
    setSendingId(id);
    setSendMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setSendMsg({ id, text: data.error || 'Could not send', ok: false }); setSendingId(null); return; }
      setSendMsg({ id, text: 'Sent!', ok: true });
      loadInvoices();
    } catch {
      setSendMsg({ id, text: 'Network error', ok: false });
    }
    setSendingId(null);
  };

  if (!mounted) return null;

  return (
    <Screen title="Invoicing" subtitle="Create and send invoices to your customers">
      <div className="space-y-4">
        <button onClick={() => setShowForm(true)} className="btn btn-accent btn-full gap-2 py-4">
          <Plus className="h-5 w-5" />New Invoice
        </button>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
        ) : invoices.length === 0 ? (
          <div className="tile p-10 text-center">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-700">No invoices yet</p>
            <p className="text-sm text-muted mt-1">Create your first invoice to send to a customer.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map(inv => (
              <div key={inv.id} className="tile p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-text text-sm">{inv.invoice_number} — {inv.customer_name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(inv.created_at).toLocaleDateString('en-US')}
                      {inv.due_date && ` · Due ${new Date(inv.due_date).toLocaleDateString('en-US')}`}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                    inv.status === 'sent' ? 'bg-green-100 text-green-700' : inv.status === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                    {inv.status}
                  </span>
                </div>
                <p className="num font-black text-xl text-text mb-3">{fmt.currency(inv.total)}</p>
                <div className="flex items-center gap-2">
                  <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold text-sub py-2.5 hover:bg-surface">
                    <Download className="h-4 w-4" />PDF
                  </a>
                  <button onClick={() => sendInvoice(inv.id)} disabled={sendingId === inv.id}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50">
                    {sendingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {inv.status === 'sent' ? 'Resend' : 'Send'}
                  </button>
                </div>
                {sendMsg?.id === inv.id && (
                  <p className={cn('text-xs font-semibold mt-2', sendMsg.ok ? 'text-green-600' : 'text-red-600')}>{sendMsg.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create invoice modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="font-black text-lg text-text">New Invoice</p>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X className="h-5 w-5 text-muted" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="lbl">Customer name *</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="inp" placeholder="Jane's Deli" />
              </div>
              <div>
                <label className="lbl">Customer email</label>
                <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="inp" placeholder="jane@example.com" />
              </div>
              <div>
                <label className="lbl">Customer address</label>
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="inp" placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Due date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="inp" />
                </div>
                <div>
                  <label className="lbl">Tax rate (%)</label>
                  <input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(e.target.value)} className="inp num" />
                </div>
              </div>

              <div>
                <label className="lbl">Line items</label>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={it.description} onChange={e => updateItem(i, 'description', e.target.value)}
                        placeholder="Description" className="inp flex-1" />
                      <input type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                        placeholder="Qty" className="inp num w-16" />
                      <input type="number" step="0.01" value={it.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)}
                        placeholder="Price" className="inp num w-24" />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-400" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addItem} className="text-accent text-sm font-semibold mt-2 flex items-center gap-1">
                  <Plus className="h-4 w-4" />Add line item
                </button>
              </div>

              <div>
                <label className="lbl">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="inp resize-none" placeholder="Optional" />
              </div>

              <div className="rounded-xl bg-surface p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="num font-semibold">{fmt.currency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Tax</span><span className="num font-semibold">{fmt.currency(taxAmount)}</span></div>
                <div className="flex justify-between text-base font-black text-accent pt-1"><span>Total</span><span className="num">{fmt.currency(total)}</span></div>
              </div>

              {formErr && <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formErr}</p>}

              <button onClick={createInvoice} disabled={creating} className="btn btn-accent btn-full gap-2 py-4">
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
