import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5-20251001';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const formData = await request.formData();
    const files = formData.getAll('file') as File[];
    for (let i = 0; i < 10; i++) { const f = formData.get(`file${i}`) as File | null; if (f && f.size > 0) files.push(f); }
    if (files.length === 0) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const content: any[] = [{
      type: 'text',
      text: `Extract sales data from this register/Modisoft daily report. Return ONLY valid JSON (no markdown):
{"report_date":null,"gross_sales":null,"net_sales":null,"cash_sales":null,"card_sales":null,"tax_collected":null,"transaction_count":null,"top_categories":[{"name":"","sales":0,"units":0}],"top_products":[{"name":"","sales":0,"units":0}],"notes":""}`
    }];

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.type === 'application/pdf') {
        content.push({ type: 'file', file: { filename: file.name, file_data: `data:${file.type};base64,${buf.toString('base64')}` } });
      } else {
        content.push({ type: 'image_url', image_url: { url: `data:${file.type};base64,${buf.toString('base64')}` } });
      }
      try { await createAdminClient().storage.from('reports').upload(`${store.id}/${crypto.randomUUID()}.jpg`, buf, { contentType: file.type }); } catch { /* ok */ }
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content }] }),
    });

    if (!res.ok) return NextResponse.json({ error: `AI failed (${res.status})` }, { status: 502 });
    const orData = await res.json();
    const text = orData?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try { parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim()); }
    catch { return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 }); }

    // Save to register_syncs (non-blocking)
    try {
      await createAdminClient().from('register_syncs').insert({ store_id: store.id, sync_date: parsed.report_date ?? new Date().toISOString().split('T')[0], source: 'modisoft', status: 'completed', raw_ai_response: parsed, gross_sales: parsed.gross_sales, net_sales: parsed.net_sales, cash_sales: parsed.cash_sales, card_sales: parsed.card_sales, tax_collected: parsed.tax_collected, transaction_count: parsed.transaction_count, top_categories: parsed.top_categories ?? [], top_products: parsed.top_products ?? [] });
    } catch { /* table may not exist */ }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
