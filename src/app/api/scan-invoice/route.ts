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

    // Build content with all pages
    const content: any[] = [{
      type: 'text',
      text: `Extract invoice data from these images. Return ONLY valid JSON (no markdown):
{"vendor_name":null,"vendor_company":null,"invoice_number":null,"invoice_date":null,"total_amount":null,"line_items":[{"description":"product name","quantity":1,"unit_cost":0}]}`
    }];

    const buffers: Buffer[] = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      buffers.push(buf);
      if (file.type === 'application/pdf') {
        content.push({ type: 'file', file: { filename: file.name, file_data: `data:${file.type};base64,${buf.toString('base64')}` } });
      } else {
        content.push({ type: 'image_url', image_url: { url: `data:${file.type};base64,${buf.toString('base64')}` } });
      }
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content }] }),
    });

    if (!res.ok) return NextResponse.json({ error: `AI failed (${res.status})` }, { status: 502 });
    const orData = await res.json();
    const text = orData?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try { parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim()); }
    catch { return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 }); }

    // Try save file (non-blocking)
    try {
      await createAdminClient().storage.from('invoices').upload(`${store.id}/${crypto.randomUUID()}.jpg`, buffers[0], { contentType: files[0].type });
    } catch { /* bucket may not exist */ }

    const admin = createAdminClient();
    const { data: existing } = await admin.from('products').select('id,name,unit_cost,unit_price').eq('store_id', store.id).eq('is_active', true);

    const lineItems = (parsed.line_items ?? []).map((item: any) => {
      const desc = (item.description ?? '').toLowerCase();
      const match = (existing ?? []).find(p => p.name.toLowerCase() === desc || desc.includes(p.name.toLowerCase()));
      const cost = Number(item.unit_cost) || 0;
      const oldCost = match ? Number(match.unit_cost) : null;
      return {
        raw_description: item.description ?? 'Unknown', quantity: Number(item.quantity) || 0,
        unit_cost: cost, old_cost: oldCost, line_total: (Number(item.quantity) || 0) * cost,
        product_id: match?.id ?? null, matched_name: match?.name ?? null,
        suggested_price: Math.round(cost * 1.3 * 100) / 100, old_price: match ? Number(match.unit_price) : null,
        price_changed: !!(match && oldCost !== null && Math.abs(cost - oldCost) > 0.001),
        is_new_product: !match, current_price: match?.unit_price ?? null, current_quantity: null,
        action: match ? 'update' : 'create',
      };
    });

    const priceChanges = lineItems.filter((li: any) => li.price_changed).length;
    const { data: invoice } = await admin.from('invoices').insert({
      store_id: store.id, vendor_name: parsed.vendor_name, vendor_company: parsed.vendor_company,
      invoice_number: parsed.invoice_number, invoice_date: parsed.invoice_date,
      total_amount: parsed.total_amount, status: 'NEEDS_REVIEW',
      price_changes_count: priceChanges, raw_ai_response: parsed,
    }).select('id').single();

    const { data: savedItems } = await admin.from('invoice_items').insert(
      lineItems.map((li: any) => ({ invoice_id: invoice?.id, product_id: li.product_id, raw_description: li.raw_description, quantity: li.quantity, unit_cost: li.unit_cost, old_cost: li.old_cost, line_total: li.line_total, suggested_price: li.suggested_price, old_price: li.old_price, price_changed: li.price_changed, is_new_product: li.is_new_product, action: li.action }))
    ).select('*');

    return NextResponse.json({
      invoice: { id: invoice?.id, vendor_name: parsed.vendor_name, vendor_company: parsed.vendor_company, invoice_number: parsed.invoice_number, total_amount: parsed.total_amount, status: 'NEEDS_REVIEW', price_changes_count: priceChanges },
      items: (savedItems ?? []).map((s: any, i: number) => ({ ...s, matched_name: lineItems[i]?.matched_name, current_price: lineItems[i]?.current_price })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
