import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function GET(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get('store_id');
  const { store, error: storeErr } = await getActiveStore(sb, user.id, storeId);
  if (!store) return NextResponse.json({ error: storeErr || 'No store found' }, { status: 404 });

  const { data, error } = await sb.from('customer_invoices')
    .select('*, customer_invoice_items(*)')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { customer_name, customer_email, customer_address, due_date, notes, tax_rate, items, store_id } = await req.json();

    const { store, error: storeErr } = await getActiveStore(sb, user.id, store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store found' }, { status: 404 });

    if (!customer_name?.trim()) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    for (const it of items) {
      if (!it.description?.trim() || !it.quantity || it.unit_price === undefined || it.unit_price === null) {
        return NextResponse.json({ error: 'Each line item needs a description, quantity, and price' }, { status: 400 });
      }
    }

    const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
    const taxRateNum = Number(tax_rate) || 0;
    const taxAmount = subtotal * (taxRateNum / 100);
    const total = subtotal + taxAmount;

    // Simple sequential invoice number per store
    const { count } = await sb.from('customer_invoices').select('id', { count: 'exact', head: true }).eq('store_id', store.id);
    const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, '0')}`;

    const { data: invoice, error: invErr } = await sb.from('customer_invoices').insert({
      store_id: store.id,
      invoice_number: invoiceNumber,
      customer_name: customer_name.trim(),
      customer_email: (customer_email || '').trim() || null,
      customer_address: (customer_address || '').trim() || null,
      due_date: due_date || null,
      notes: (notes || '').trim() || null,
      tax_rate: taxRateNum,
      subtotal,
      tax_amount: taxAmount,
      total,
      status: 'draft',
    }).select('id').single();

    if (invErr) {
      console.error('invoice creation failed:', invErr);
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const { error: itemsErr } = await sb.from('customer_invoice_items').insert(
      items.map((it: any) => ({
        invoice_id: invoice.id,
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        line_total: Number(it.quantity) * Number(it.unit_price),
      }))
    );

    if (itemsErr) {
      console.error('invoice items creation failed:', itemsErr);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoiceId: invoice.id, invoiceNumber });
  } catch (err: any) {
    console.error('invoice creation threw:', err);
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 });
  }
}
