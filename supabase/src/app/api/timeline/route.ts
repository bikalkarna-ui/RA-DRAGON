import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ events: [] });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ events: [] });
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const { data } = await sb.from('timeline_events').select('*').eq('store_id', store.id).eq('event_date', date).order('event_time', { ascending: true });
    return NextResponse.json({ events: data || [] });
  } catch (err: any) { return NextResponse.json({ events: [] }); }
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
    const { data } = await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, ...body }).select('*').single();
    return NextResponse.json({ event: data });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
