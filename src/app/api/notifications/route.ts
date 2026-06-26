import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ notifications: [] });

    const admin = createAdminClient();

    // Auto-generate stock notifications
    const { data: products } = await admin.from('products')
      .select('id,name,quantity,min_quantity,max_quantity,vendor_company,last_sold_at')
      .eq('store_id', store.id).eq('is_active', true);

    const now = new Date();
    for (const prod of products ?? []) {
      const isOut = prod.quantity === 0;
      const isLow = prod.quantity > 0 && prod.quantity <= prod.min_quantity;
      const isOver = prod.max_quantity && prod.quantity >= prod.max_quantity;

      if (isOut || isLow || isOver) {
        const type = isOut ? 'out_of_stock' : isLow ? 'low_stock' : 'overstock';
        const existing = await admin.from('notifications')
          .select('id').eq('store_id', store.id).eq('type', type)
          .eq('product_id', prod.id).eq('is_read', false).maybeSingle();

        if (!existing.data) {
          await admin.from('notifications').insert({
            store_id: store.id,
            type,
            title: isOut ? `Out of stock: ${prod.name}` : isLow ? `Low stock: ${prod.name}` : `Overstocked: ${prod.name}`,
            message: isOut
              ? `${prod.name} is completely out. Order from ${prod.vendor_company ?? 'vendor'} now.`
              : isLow
              ? `Only ${prod.quantity} units left (min: ${prod.min_quantity}). Reorder soon.`
              : `${prod.quantity} units in stock (max: ${prod.max_quantity}). Consider a sale.`,
            product_id: prod.id,
            data: { quantity: prod.quantity, min_quantity: prod.min_quantity, max_quantity: prod.max_quantity, vendor: prod.vendor_company },
          });
        }
      }
    }

    const { data: notifs } = await admin.from('notifications')
      .select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);

    return NextResponse.json({ notifications: notifs ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { ids } = await request.json();
    const admin = createAdminClient();
    await admin.from('notifications').update({ is_read: true }).in('id', ids);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
