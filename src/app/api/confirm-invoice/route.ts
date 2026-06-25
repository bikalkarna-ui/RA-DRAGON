import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { invoiceId, items } = await request.json();
    const admin = createAdminClient();
    const { data: invoice } = await admin.from('invoices').select('store_id').eq('id', invoiceId).single();
    if (!invoice || invoice.store_id !== store.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let created = 0, updated = 0, priceChanges = 0;

    for (const li of items) {
      if (li.action === 'skip') continue;
      if (li.action === 'create') {
        const { data: np } = await admin.from('products').insert({
          store_id: store.id, name: li.name, sku: li.sku || null, barcode: li.barcode || null,
          vendor_company: li.vendor_company || null, unit_cost: li.unit_cost, unit_price: li.unit_price,
          quantity: li.quantity, min_quantity: 5, max_quantity: 100, taxable: true,
        }).select('id').single();
        if (np) { await admin.from('invoice_items').update({ product_id: np.id }).eq('id', li.id); created++; }
      }
      if (li.action === 'update' && li.product_id) {
        const { data: ex } = await admin.from('products').select('quantity,unit_cost').eq('id', li.product_id).single();
        const updates: any = { quantity: (ex?.quantity ?? 0) + Number(li.quantity), unit_cost: li.unit_cost };
        if (li.unit_price) updates.unit_price = li.unit_price;
        await admin.from('products').update(updates).eq('id', li.product_id);
        if (li.price_changed) priceChanges++;
        updated++;
      }
    }

    await admin.from('invoices').update({ status: 'COMPLETED' }).eq('id', invoiceId);
    return NextResponse.json({ success: true, created, updated, priceChanges });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
