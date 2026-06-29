import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('id');
    const reportDate = searchParams.get('date');

    if (reportId) {
      await sb.from('report_uploads').delete().eq('daily_report_id', reportId).catch(() => {});
      await sb.from('register_reports').delete().eq('daily_report_id', reportId).catch(() => {});
      await sb.from('daily_reports').delete().eq('id', reportId).eq('store_id', store.id);
    } else if (reportDate) {
      const { data: dr } = await sb.from('daily_reports').select('id').eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
      if (dr) {
        await sb.from('report_uploads').delete().eq('daily_report_id', dr.id).catch(() => {});
        await sb.from('register_reports').delete().eq('daily_report_id', dr.id).catch(() => {});
        await sb.from('daily_reports').delete().eq('id', dr.id);
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });
    const { id, store_notes, status } = await request.json();
    const { data } = await sb.from('daily_reports').update({ store_notes, status, updated_at: new Date().toISOString() }).eq('id', id).eq('store_id', store.id).select('*').single();
    return NextResponse.json({ success: true, report: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
