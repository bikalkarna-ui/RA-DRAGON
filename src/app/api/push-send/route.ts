import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';
import { sendStoreNotification } from '@/lib/send-notification';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { store_id, title: customTitle, body: customBody } = body;

    const { store, error: storeErr } = await getActiveStore(sb, user.id, store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });

    let title = customTitle;
    let body_text = customBody;

    if (!title || !body_text) {
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

      title = `${store.name} — Daily Summary`;
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
    }

    const result = await sendStoreNotification(sb, store.id, title, body_text);
    return NextResponse.json({ success: true, ...result, notification: { title, body: body_text } });
  } catch (err: any) {
    console.error('push-send threw:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
