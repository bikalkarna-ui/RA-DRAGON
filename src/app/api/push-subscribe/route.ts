import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { subscription, store_id } = await request.json();
    if (!subscription) return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });

    const { store, error: storeErr } = await getActiveStore(sb, user.id, store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });

    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: user.id, store_id: store.id,
      subscription: subscription,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      console.error('push_subscriptions upsert failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('push-subscribe threw:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { error } = await sb.from('push_subscriptions').delete().eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
