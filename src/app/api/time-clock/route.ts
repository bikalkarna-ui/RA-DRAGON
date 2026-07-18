import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { action, employee_id, employee_name, notes, store_id } = await request.json();
    const { store, error: storeErr } = await getActiveStore(sb, user.id, store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });

    if (action === 'clock_in') {
      // Check not already clocked in
      const { data: open } = await sb.from('time_clock').select('id').eq('employee_id', employee_id).is('clock_out', null).maybeSingle();
      if (open) return NextResponse.json({ error: 'Already clocked in' }, { status: 400 });

      const { data } = await sb.from('time_clock').insert({ store_id: store.id, employee_id, employee_name, notes }).select('*').single();
      return NextResponse.json({ success: true, record: data });
    }

    if (action === 'clock_out') {
      const { data: open } = await sb.from('time_clock').select('*').eq('employee_id', employee_id).is('clock_out', null).maybeSingle();
      if (!open) return NextResponse.json({ error: 'Not clocked in' }, { status: 400 });

      const now = new Date();
      const clockIn = new Date(open.clock_in);
      const hours = (now.getTime() - clockIn.getTime()) / 3600000;

      const { data } = await sb.from('time_clock').update({ clock_out: now.toISOString(), hours_worked: Math.round(hours * 100) / 100, notes }).eq('id', open.id).select('*').single();
      return NextResponse.json({ success: true, record: data, hours_worked: hours });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ records: [] });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ records: [] });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString();

    const { data } = await sb.from('time_clock').select('*, employees(name, role)').eq('store_id', store.id).gte('clock_in', from).order('clock_in', { ascending: false });
    return NextResponse.json({ records: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ records: [], error: err.message });
  }
}
