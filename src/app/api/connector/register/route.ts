import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id,name').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found' }, { status: 400 });
    const apiKey = 'rad_' + crypto.randomBytes(24).toString('hex');
    await sb.from('stores').update({ connector_api_key: apiKey }).eq('id', store.id);
    return NextResponse.json({
      success: true, store_id: store.id, store_name: store.name, api_key: apiKey,
      cloud_url: process.env.NEXT_PUBLIC_APP_URL || 'https://ryxsor-ai.vercel.app',
    });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
