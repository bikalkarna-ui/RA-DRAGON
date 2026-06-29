import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
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
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });
    const body = await request.json();
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await sb.from('daily_checklists').upsert({ store_id: store.id, report_date: today, ...body, closed_at: body.is_closed ? new Date().toISOString() : null }, { onConflict: 'store_id,report_date' }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ checklist: data });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
