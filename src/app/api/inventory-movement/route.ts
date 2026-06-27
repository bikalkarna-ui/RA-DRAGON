import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const body = await request.json();
    const { product_id, type, quantity, reference_type, reference_id, reference_label, employee_name, notes, unit_cost, unit_price } = body;

    // Get current stock
    const { data: product } = await sb.from('products').select('quantity, name, unit_cost, unit_price').eq('id', product_id).single();
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const qty_before = Number(product.quantity);
    const qty_after  = qty_before + Number(quantity);

    // Record movement
    const { data: movement, error: mvErr } = await sb.from('inventory_movements').insert({
      store_id: store.id, product_id,
      product_name: product.name, type,
      quantity: Number(quantity),
      quantity_before: qty_before,
      quantity_after:  qty_after,
      unit_cost:  unit_cost  ?? product.unit_cost,
      unit_price: unit_price ?? product.unit_price,
      reference_type, reference_id, reference_label,
      employee_name, notes,
    }).select('id').single();

    if (mvErr) throw mvErr;

    // Update product quantity
    await sb.from('products').update({ quantity: Math.max(0, qty_after) }).eq('id', product_id);

    return NextResponse.json({ success: true, movementId: movement?.id, qty_before, qty_after });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ movements: [] });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ movements: [] });

    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');
    const limit = parseInt(searchParams.get('limit') ?? '50');

    let query = sb.from('inventory_movements').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(limit);
    if (product_id) query = query.eq('product_id', product_id);

    const { data } = await query;
    return NextResponse.json({ movements: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ movements: [], error: err.message });
  }
}
