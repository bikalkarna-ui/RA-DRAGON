import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    // Get store — check form data first (sent by client), then look up by owner
    const formData = await request.formData();
    const formStoreId = formData.get('store_id') as string | null;
    
    let store: { id: string } | null = null;
    if (formStoreId) {
      // Client sent store_id — verify it belongs to this user
      const { data } = await sb.from('stores').select('id').eq('id', formStoreId).eq('owner_id', user.id).maybeSingle();
      store = data;
    }
    if (!store) {
      // Fall back to first store for this user
      const { data } = await sb.from('stores').select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      store = data;
    }
    if (!store) return NextResponse.json({ error: 'No store found — please complete store setup in Settings' }, { status: 400 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const files: File[] = [...(formData.getAll('file') as File[]).filter((f: File) => f.size > 0)];
    for (let i = 1; i <= 10; i++) { const f = formData.get(`file${i}`) as File | null; if (f && f.size > 0) files.push(f); }
    if (files.length === 0) return NextResponse.json({ error: 'No file received' }, { status: 400 });

    const content: any[] = [{
      type: 'text',
      text: 'Extract sales data from this register/Modisoft daily report. Return ONLY valid JSON (no markdown):\n{"report_date":null,"gross_sales":null,"net_sales":null,"cash_sales":null,"card_sales":null,"tax_collected":null,"transaction_count":null,"top_categories":[{"name":"","sales":0}],"top_products":[{"name":"","sales":0,"units":0}],"notes":""}'
    }];

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const b64 = buf.toString('base64');
      const mime = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(file.type) ? file.type : 'image/jpeg';
      if (mime === 'application/pdf') {
        content.push({ type: 'file', file: { filename: file.name, file_data: `data:application/pdf;base64,${b64}` } });
      } else {
        content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
      }
    }

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content }] }),
    });

    const rawText = await aiRes.text();
    if (!aiRes.ok) {
      let msg = `OpenRouter ${aiRes.status}`;
      try { msg = JSON.parse(rawText)?.error?.message || msg; } catch {}
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const aiText = JSON.parse(rawText)?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try { parsed = JSON.parse(aiText.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim()); }
    catch { return NextResponse.json({ error: 'AI could not parse the report — try a clearer photo' }, { status: 502 }); }

    // Save to register_syncs using authenticated client
    try {
      await sb.from('report_uploads').insert({
        store_id: store.id,
        sync_date: parsed.report_date ?? new Date().toISOString().split('T')[0],
        source: 'modisoft',
        status: 'completed',
        raw_ai_response: parsed,
        gross_sales: parsed.gross_sales,
        net_sales: parsed.net_sales,
        cash_sales: parsed.cash_sales,
        card_sales: parsed.card_sales,
        tax_collected: parsed.tax_collected,
        transaction_count: parsed.transaction_count,
        top_categories: parsed.top_categories ?? [],
        top_products: parsed.top_products ?? [],
      });
    } catch { /* table may not exist in old schemas */ }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('scan-report error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
