import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function toDate(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const a = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (a) { const y = a[3].length===2?'20'+a[3]:a[3]; return `${y}-${a[1].padStart(2,'0')}-${a[2].padStart(2,'0')}`; }
    const M: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const b = s.match(/([a-z]{3})\w*\s+(\d{1,2})[,\s]+(\d{4})/i);
    if (b) { const mn=M[b[1].toLowerCase()]; if(mn) return `${b[3]}-${mn}-${b[2].padStart(2,'0')}`; }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

    const formData = await request.formData();
    const formStoreId = formData.get('store_id') as string | null;

    let store: { id: string } | null = null;
    if (formStoreId) {
      const { data } = await sb.from('stores').select('id').eq('id', formStoreId).eq('owner_id', user.id).maybeSingle();
      store = data;
    }
    if (!store) {
      const { data } = await sb.from('stores').select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      store = data;
    }
    if (!store) return NextResponse.json({ error: 'No store found — complete store setup in Settings' }, { status: 400 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set in Vercel' }, { status: 500 });

    // Collect files
    const files: File[] = [];
    for (const [, v] of formData.entries()) {
      if (v instanceof File && v.size > 0) files.push(v);
    }
    if (!files.length) return NextResponse.json({ error: 'No file received' }, { status: 400 });

    // Build AI request
    const content: any[] = [{
      type: 'text',
      text: `Read this vendor invoice. Extract every product line item with its quantity and cost price.
Return ONLY this JSON (no markdown):
{"vendor_name":null,"vendor_company":null,"invoice_number":null,"invoice_date":null,"total_amount":null,"line_items":[{"description":"exact product name from invoice","quantity":1,"unit_cost":0.00,"upc":null,"sku":null}]}

Rules:
- invoice_date: YYYY-MM-DD format
- unit_cost: cost price per unit (what store pays), NOT selling price
- quantity: number of units received
- upc/sku: barcode or item code if visible, else null
- Extract ALL line items, even if many
- Never calculate — read numbers exactly as printed`
    }];

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const b64 = buf.toString('base64');
      const mime = file.type || 'image/jpeg';
      if (mime === 'application/pdf') {
        content.push({ type: 'file', file: { filename: file.name || 'invoice.pdf', file_data: `data:application/pdf;base64,${b64}` } });
      } else {
        content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
      }
    }

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content }] }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return NextResponse.json({ error: `AI error ${aiRes.status}: ${txt.slice(0,200)}` }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const raw = (aiData?.choices?.[0]?.message?.content ?? '').trim()
      .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

    let parsed: any;
    const match = raw.match(/\{[\s\S]*/);
    if (!match) return NextResponse.json({ error: 'AI could not read the invoice — try a clearer photo' }, { status: 502 });

    let js = match[0];
    try { parsed = JSON.parse(js); }
    catch {
      // Try to close truncated JSON
      let depth=0, inStr=false, esc=false;
      for (const ch of js) {
        if (esc) { esc=false; continue; }
        if (ch==='\\') { esc=true; continue; }
        if (ch==='"') { inStr=!inStr; continue; }
        if (!inStr) { if(ch==='{'||ch==='[') depth++; else if(ch==='}'||ch===']') depth--; }
      }
      if (inStr) js+='"';
      if (depth>0) js+='}'.repeat(depth);
      try { parsed = JSON.parse(js); }
      catch { return NextResponse.json({ error: 'Could not parse AI response — try again' }, { status: 502 }); }
    }

    // Load existing products for matching
    const { data: existing } = await sb.from('products')
      .select('id,name,unit_cost,unit_price,barcode,sku')
      .eq('store_id', store.id)
      .eq('is_active', true);

    const lineItems = (parsed.line_items ?? []).map((item: any) => {
      const desc = (item.description ?? '').toLowerCase().trim();
      const upc = (item.upc ?? '').toString().trim();
      const sku = (item.sku ?? '').toString().trim();
      const cost = toNum(item.unit_cost);

      // Match by barcode/sku first, then name
      let match = (existing ?? []).find(p =>
        (upc && p.barcode && p.barcode === upc) ||
        (sku && p.sku && p.sku === sku)
      );
      if (!match) {
        match = (existing ?? []).find(p => {
          const pn = p.name.toLowerCase();
          return pn === desc || desc.includes(pn) || pn.includes(desc);
        });
      }

      const oldCost = match ? toNum(match.unit_cost) : null;
      const priceChanged = !!(match && oldCost !== null && Math.abs(cost - oldCost) > 0.001);

      return {
        raw_description: item.description ?? 'Unknown item',
        quantity: Math.max(0, Math.round(toNum(item.quantity))) || 1,
        unit_cost: cost,
        old_cost: oldCost,
        line_total: toNum(item.quantity) * cost,
        product_id: match?.id ?? null,
        matched_name: match?.name ?? null,
        suggested_price: Math.round(cost * 1.3 * 100) / 100,
        old_price: match ? toNum(match.unit_price) : null,
        price_changed: priceChanged,
        is_new_product: !match,
        current_price: match ? toNum(match.unit_price) : null,
        action: match ? 'update' : 'create',
        upc: upc || null,
        sku: sku || null,
      };
    });

    const priceChanges = lineItems.filter((li: any) => li.price_changed).length;
    const invoiceDate = toDate(parsed.invoice_date);

    // Save invoice
    const { data: invoice, error: invErr } = await sb.from('invoices').insert({
      store_id: store.id,
      vendor_name: parsed.vendor_name ?? null,
      vendor_company: parsed.vendor_company ?? null,
      invoice_number: parsed.invoice_number ? String(parsed.invoice_number) : null,
      invoice_date: invoiceDate,
      total_amount: toNum(parsed.total_amount) || null,
      status: 'NEEDS_REVIEW',
      price_changes_count: priceChanges,
      raw_ai_response: parsed,
    }).select('id').single();

    if (invErr) return NextResponse.json({ error: `Failed to save invoice: ${invErr.message}` }, { status: 500 });

    // Save line items
    const { data: savedItems, error: itemErr } = await sb.from('invoice_items').insert(
      lineItems.map((li: any) => ({
        invoice_id: invoice?.id,
        product_id: li.product_id,
        raw_description: li.raw_description,
        quantity: li.quantity,
        unit_cost: li.unit_cost,
        old_cost: li.old_cost,
        line_total: li.line_total,
        suggested_price: li.suggested_price,
        old_price: li.old_price,
        price_changed: li.price_changed,
        is_new_product: li.is_new_product,
        action: li.action,
      }))
    ).select('*');

    if (itemErr) console.error('invoice_items insert error:', itemErr);

    return NextResponse.json({
      invoice: {
        id: invoice?.id,
        vendor_name: parsed.vendor_name,
        vendor_company: parsed.vendor_company,
        invoice_number: parsed.invoice_number,
        total_amount: toNum(parsed.total_amount) || null,
        status: 'NEEDS_REVIEW',
        price_changes_count: priceChanges,
      },
      items: (savedItems ?? []).map((s: any, i: number) => ({
        ...s,
        matched_name: lineItems[i]?.matched_name,
        current_price: lineItems[i]?.current_price,
        upc: lineItems[i]?.upc,
        sku: lineItems[i]?.sku,
      })),
    });

  } catch (err: any) {
    console.error('scan-invoice error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
