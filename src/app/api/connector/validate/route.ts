import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id') || request.headers.get('X-Store-ID');
    const apiKey = request.headers.get('X-API-Key');
    if (!storeId || !apiKey) return NextResponse.json({ error: 'Missing store_id or API key' }, { status: 400 });
    const { data: store } = await sb.from('stores').select('id,name,connector_api_key').eq('id', storeId).maybeSingle();
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    if (!store.connector_api_key) {
      await sb.from('stores').update({ connector_api_key: apiKey }).eq('id', storeId);
      return NextResponse.json({ valid: true, store_name: store.name, first_connect: true });
    }
    if (store.connector_api_key !== apiKey) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    return NextResponse.json({ valid: true, store_name: store.name });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
