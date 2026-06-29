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

    const { data: inv } = await sb.from('invoices').select('*').eq('id', invoiceId).single();
    if (!inv || inv.store_id !== store.id) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    let created = 0, updated = 0;

    for (const li of items) {
      if (li.action === 'skip') continue;

      if (li.action === 'create') {
        // Create new product
        const { data: np } = await sb.from('products').insert({
          store_id: store.id, name: li.name || li.raw_description,
          sku: li.sku || null, barcode: li.barcode || null,
          vendor_company: li.vendor_company || inv.vendor_company || null,
          unit_cost: li.unit_cost, unit_price: li.unit_price || Math.round(li.unit_cost * 1.3 * 100) / 100,
          quantity: Number(li.quantity) || 0,
          min_quantity: 5, max_quantity: 100, taxable: true,
          last_received_at: new Date().toISOString(), last_invoice_id: invoiceId,
        }).select('id').single();
        if (np) {
          await sb.from('invoice_items').update({ product_id: np.id }).eq('id', li.id);
          // Record inventory movement
          if (li.quantity > 0) {
            await sb.from('inventory_movements').insert({
              store_id: store.id, product_id: np.id, product_name: li.name || li.raw_description,
              type: 'receive', quantity: Number(li.quantity), quantity_before: 0, quantity_after: Number(li.quantity),
              unit_cost: li.unit_cost, reference_type: 'invoice',
              reference_id: invoiceId, reference_label: `Invoice — ${inv.vendor_name ?? 'vendor'}`,
            });
          }
          created++;
        }
      }

      if (li.action === 'update' && li.product_id) {
        const { data: ex } = await sb.from('products').select('quantity,unit_cost,unit_price,name').eq('id', li.product_id).single();
        const newQty = (ex?.quantity ?? 0) + Number(li.quantity);
        const updates: any = { quantity: newQty, last_received_at: new Date().toISOString(), last_invoice_id: invoiceId, unit_cost: li.unit_cost };
        if (li.unit_price) updates.unit_price = li.unit_price;

        await sb.from('products').update(updates).eq('id', li.product_id);

        // Record inventory movement
        await sb.from('inventory_movements').insert({
          store_id: store.id, product_id: li.product_id, product_name: ex?.name ?? li.raw_description,
          type: 'receive', quantity: Number(li.quantity),
          quantity_before: ex?.quantity ?? 0, quantity_after: newQty,
          unit_cost: li.unit_cost, reference_type: 'invoice',
          reference_id: invoiceId, reference_label: `Invoice — ${inv.vendor_name ?? 'vendor'}`,
        });

        // Record price history if cost changed
        if (ex && Math.abs(Number(ex.unit_cost) - Number(li.unit_cost)) > 0.001) {
          const oldMargin = ex.unit_price > 0 ? ((ex.unit_price - ex.unit_cost) / ex.unit_price * 100) : 0;
          const newPrice  = li.unit_price || ex.unit_price;
          const newMargin = newPrice > 0 ? ((newPrice - li.unit_cost) / newPrice * 100) : 0;
          await sb.from('price_history').insert({
            store_id: store.id, product_id: li.product_id, product_name: ex.name,
            old_cost: ex.unit_cost, new_cost: li.unit_cost,
            old_price: ex.unit_price, new_price: newPrice,
            old_margin: oldMargin, new_margin: newMargin,
            source: 'invoice', invoice_id: invoiceId, vendor_name: inv.vendor_name,
          });
        }
        updated++;
      }
    }

    await sb.from('invoices').update({ status: 'COMPLETED' }).eq('id', invoiceId);
    return NextResponse.json({ success: true, created, updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
