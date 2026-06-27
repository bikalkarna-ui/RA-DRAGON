import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { invoiceId, items } = await request.json();

    // Verify invoice belongs to this store
    const { data: inv } = await sb.from('invoices').select('store_id').eq('id', invoiceId).single();
    if (!inv || inv.store_id !== store.id) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    let created = 0, updated = 0;
    for (const li of items) {
      if (li.action === 'skip') continue;

      if (li.action === 'create') {
        const { data: np } = await sb.from('products').insert({
          store_id: store.id,
          name: li.name || li.raw_description,
          sku: li.sku || null,
          barcode: li.barcode || null,
          vendor_company: li.vendor_company || null,
          unit_cost: li.unit_cost,
          unit_price: li.unit_price || Math.round(li.unit_cost * 1.3 * 100) / 100,
          quantity: li.quantity || 0,
          min_quantity: 5,
          max_quantity: 100,
          taxable: true,
        }).select('id').single();
        if (np) { await sb.from('invoice_items').update({ product_id: np.id }).eq('id', li.id); created++; }
      }

      if (li.action === 'update' && li.product_id) {
        const { data: ex } = await sb.from('products').select('quantity').eq('id', li.product_id).single();
        await sb.from('products').update({
          quantity: (ex?.quantity ?? 0) + Number(li.quantity),
          unit_cost: li.unit_cost,
          ...(li.unit_price ? { unit_price: li.unit_price } : {}),
        }).eq('id', li.product_id);
        updated++;
      }
    }

    await sb.from('invoices').update({ status: 'COMPLETED' }).eq('id', invoiceId);
    return NextResponse.json({ success: true, created, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
