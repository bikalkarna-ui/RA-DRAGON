import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found' }, { status: 400 });

    const body = await request.json();
    const { action, amount, name, reason, vendor } = body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const amountNum = Math.abs(parseFloat(amount) || 0);
    const timeStr = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});

    if (action === 'safe_drop') {
      const { data: dr } = await sb.from('daily_reports').select('id,safe_drops').eq('store_id', store.id).eq('report_date', today).maybeSingle();
      const newTotal = Number(dr?.safe_drops || 0) + amountNum;
      if (dr) {
        const { error: e } = await sb.from('daily_reports').update({ safe_drops: newTotal, updated_at: now }).eq('id', dr.id);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      } else {
        const { error: e } = await sb.from('daily_reports').insert({ store_id: store.id, report_date: today, safe_drops: amountNum, status: 'in_progress' });
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      }
      try { await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, type: 'safe_drop', title: `Safe Drop — ${name||'Cashier'}`, description: `$${amountNum.toFixed(2)} at ${timeStr}`, amount: amountNum }); } catch {}
      return NextResponse.json({ success: true, newTotal });
    }

    if (action === 'paid_out') {
      const { data: dr } = await sb.from('daily_reports').select('id,paid_outs').eq('store_id', store.id).eq('report_date', today).maybeSingle();
      const newTotal = Number(dr?.paid_outs || 0) + amountNum;
      if (dr) {
        const { error: e } = await sb.from('daily_reports').update({ paid_outs: newTotal, updated_at: now }).eq('id', dr.id);
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      } else {
        const { error: e } = await sb.from('daily_reports').insert({ store_id: store.id, report_date: today, paid_outs: amountNum, status: 'in_progress' });
        if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      }
      try { await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, type: 'paid_out', title: `Paid Out — ${reason||'Expense'}`, description: `$${amountNum.toFixed(2)}${name?` by ${name}`:''} at ${timeStr}`, amount: amountNum }); } catch {}
      return NextResponse.json({ success: true, newTotal });
    }

    if (action === 'vendor_delivery') {
      const { error: e } = await sb.from('invoices').insert({ store_id: store.id, vendor_name: vendor||'Unknown', total_amount: amountNum||null, status: 'NEEDS_REVIEW', source: 'delivery', invoice_date: today });
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      try { await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, type: 'delivery', title: `Delivery — ${vendor}`, description: amountNum ? `$${amountNum.toFixed(2)}` : 'Amount TBD', amount: amountNum }); } catch {}
      return NextResponse.json({ success: true });
    }

    if (action === 'lottery_book') {
      const { error: e } = await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, type: 'lottery_book', title: `Book #${name} Activated`, description: `$${amountNum} scratch tickets`, amount: amountNum, metadata: JSON.stringify({ book: name, price: amountNum, status: 'active' }) });
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
