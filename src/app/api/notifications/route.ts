import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ notifications: [] });
    const storeId = request.nextUrl.searchParams.get('store_id');
    const { store } = await getActiveStore(sb, user.id, storeId);
    if (!store) return NextResponse.json({ notifications: [] });

    // Auto-generate stock notifications from current inventory
    const { data: products } = await sb.from('products')
      .select('id,name,quantity,min_quantity,max_quantity,vendor_company')
      .eq('store_id', store.id).eq('is_active', true);

    for (const prod of products ?? []) {
      const isOut  = prod.quantity === 0;
      const isLow  = prod.quantity > 0 && prod.quantity <= prod.min_quantity;
      const isOver = prod.max_quantity && prod.quantity >= prod.max_quantity;
      if (!isOut && !isLow && !isOver) continue;

      const type = isOut ? 'out_of_stock' : isLow ? 'low_stock' : 'overstock';
      try {
        await sb.from('notifications').upsert({
          store_id: store.id, type,
          title: isOut ? `${prod.name} is OUT OF STOCK` : isLow ? `${prod.name} is running low` : `${prod.name} overstocked`,
          message: isOut
            ? `Order from ${prod.vendor_company ?? 'vendor'} immediately`
            : isLow ? `Only ${prod.quantity} units left (min: ${prod.min_quantity})`
            : `${prod.quantity} units in stock (max: ${prod.max_quantity})`,
          product_id: prod.id,
          data: { quantity: prod.quantity, min_quantity: prod.min_quantity, max_quantity: prod.max_quantity, vendor: prod.vendor_company },
          is_read: false,
        }, { onConflict: 'store_id,type,product_id', ignoreDuplicates: false });
      } catch { /* ok */ }
    }

    const { data: notifs } = await sb.from('notifications')
      .select('*').eq('store_id', store.id)
      .order('created_at', { ascending: false }).limit(50);

    return NextResponse.json({ notifications: notifs ?? [] });
  } catch (err: any) {
    return NextResponse.json({ notifications: [], error: err.message });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { ids } = await request.json();
    await sb.from('notifications').update({ is_read: true }).in('id', ids);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
