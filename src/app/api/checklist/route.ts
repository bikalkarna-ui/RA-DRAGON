import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function GET(request: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { store } = await getActiveStore(sb, user.id, request.nextUrl.searchParams.get('store_id'));
  if (!store) return NextResponse.json({ checklist: null });
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('daily_checklists').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
  return NextResponse.json({ checklist: data });
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await request.json();
    const { store, error: storeErr } = await getActiveStore(sb, user.id, body.store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb.from('daily_checklists').upsert({ store_id: store.id, report_date: today, ...body, closed_at: body.is_closed ? new Date().toISOString() : null }, { onConflict: 'store_id,report_date' }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ checklist: data });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
