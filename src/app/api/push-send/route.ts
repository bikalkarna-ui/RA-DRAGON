import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { store_id, type = 'daily_summary' } = body;

    const { data: store } = await sb.from('stores').select('*').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const { data: report } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
    const { data: products } = await sb.from('products').select('quantity,min_quantity').eq('store_id', store.id).eq('is_active', true);

    const outOfStock = (products || []).filter(p => p.quantity === 0).length;
    const lowStock   = (products || []).filter(p => p.quantity > 0 && p.quantity <= p.min_quantity).length;

    const n = (v: any) => Number(v || 0);
    const grossSales  = n(report?.gross_sales);
    const shortOver   = n(report?.drawer_difference);
    const isShort     = shortOver < -0.50;
    const isOver      = shortOver > 0.50;

    let title = `${store.name} — Daily Summary`;
    let body_text = '';

    if (report) {
      body_text = `Sales: $${grossSales.toFixed(2)}`;
      if (isShort) body_text += ` · ⚠ $${Math.abs(shortOver).toFixed(2)} SHORT`;
      else if (isOver) body_text += ` · +$${shortOver.toFixed(2)} over`;
      else body_text += ' · ✓ Balanced';
      if (outOfStock > 0) body_text += ` · ${outOfStock} out of stock`;
      if (lowStock > 0) body_text += ` · ${lowStock} low`;
    } else {
      body_text = 'No report uploaded yet today. Upload your close report now.';
    }

    // Get subscriptions
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', user.id);

    // In production, you'd send to each subscription using web-push library
    // For now, return the notification data so the client can show it
    return NextResponse.json({
      success: true,
      notification: { title, body: body_text },
      subscriptions: subs?.length || 0,
    });

  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
