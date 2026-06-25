import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-sonnet-4.6';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { vendorId, vendorName } = await request.json();
    const admin = createAdminClient();

    // Get products for this vendor with recent sales velocity
    const { data: products } = await admin.from('products')
      .select('id,name,sku,unit_cost,unit_price,quantity,min_quantity,max_quantity,vendor_company')
      .eq('store_id', store.id).eq('is_active', true)
      .eq('vendor_company', vendorName);

    if (!products || products.length === 0) {
      return NextResponse.json({ error: `No products found assigned to ${vendorName}. Assign products to this vendor in Inventory.` }, { status: 400 });
    }

    // Get 30-day sales for these products
    const productIds = products.map(p => p.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: salesData } = await admin.from('sale_items')
      .select('product_id,quantity,line_total')
      .in('product_id', productIds)
      .gte('created_at', thirtyDaysAgo);

    // Calculate velocity per product
    const velocityMap = new Map<string, { qty: number; revenue: number }>();
    for (const s of salesData ?? []) {
      const cur = velocityMap.get(s.product_id) ?? { qty: 0, revenue: 0 };
      velocityMap.set(s.product_id, { qty: cur.qty + Number(s.quantity), revenue: cur.revenue + Number(s.line_total) });
    }

    const productSummary = products.map(p => ({
      id: p.id, name: p.name, sku: p.sku,
      currentStock: p.quantity, minQty: p.min_quantity, maxQty: p.max_quantity ?? 100,
      unitCost: p.unit_cost, unitPrice: p.unit_price,
      sold30Days: velocityMap.get(p.id)?.qty ?? 0,
      revenue30Days: velocityMap.get(p.id)?.revenue ?? 0,
    }));

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // Fallback: rule-based ordering
      const orderItems = productSummary
        .filter(p => p.currentStock <= p.minQty)
        .map(p => ({
          product_id: p.id, product_name: p.name, sku: p.sku ?? null,
          current_stock: p.currentStock,
          suggested_qty: Math.max(p.minQty * 2, Math.ceil(p.sold30Days / 4)),
          unit_cost: p.unitCost,
          line_total: Math.max(p.minQty * 2, Math.ceil(p.sold30Days / 4)) * p.unitCost,
          reason: `Below minimum stock (${p.currentStock}/${p.minQty})`,
        }));
      return buildOrder(admin, store.id, vendorId, vendorName, orderItems, false, 'Rule-based: all items below minimum stock.');
    }

    const prompt = `You are an inventory ordering AI for a convenience store. Analyze the product data and generate a smart reorder list for vendor: ${vendorName}.

Products data (JSON):
${JSON.stringify(productSummary, null, 2)}

Rules:
- Only include products that NEED ordering (low/out of stock, or selling fast and will run out soon)
- Calculate suggested quantity to bring stock to about 2-3 weeks of supply based on 30-day velocity
- If sold30Days = 0, only order if currentStock = 0 or below minimum
- Consider max_quantity as the ceiling
- Be concise in reasoning

Respond with ONLY valid JSON:
{
  "reasoning": "2-3 sentence summary of ordering logic",
  "items": [
    {
      "product_id": "uuid",
      "product_name": "name",
      "sku": "sku or null",
      "current_stock": number,
      "suggested_qty": number,
      "unit_cost": number,
      "reason": "why ordering this quantity"
    }
  ]
}`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: `AI failed: ${txt.slice(0, 200)}` }, { status: 502 });
    }

    const orData = await res.json();
    const content = orData?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try { parsed = JSON.parse(content.replace(/^```json\s*|```\s*$/g, '').trim()); }
    catch { return NextResponse.json({ error: 'AI returned invalid response.' }, { status: 502 }); }

    const orderItems = (parsed.items ?? []).map((item: any) => ({
      ...item,
      line_total: Number(item.suggested_qty) * Number(item.unit_cost),
    }));

    return buildOrder(admin, store.id, vendorId, vendorName, orderItems, true, parsed.reasoning);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function buildOrder(admin: any, storeId: string, vendorId: string | null, vendorName: string, items: any[], aiGenerated: boolean, reasoning: string) {
  const total = items.reduce((s: number, i: any) => s + Number(i.line_total), 0);

  const { data: order } = await admin.from('vendor_orders').insert({
    store_id: storeId, vendor_id: vendorId ?? null, vendor_name: vendorName,
    status: 'draft', ai_generated: aiGenerated, ai_reasoning: reasoning,
    total_estimated: total,
  }).select('id').single();

  if (order && items.length > 0) {
    await admin.from('vendor_order_items').insert(
      items.map(i => ({
        order_id: order.id, product_id: i.product_id, product_name: i.product_name,
        sku: i.sku ?? null, current_stock: i.current_stock,
        suggested_qty: i.suggested_qty, unit_cost: i.unit_cost,
        line_total: i.line_total, reason: i.reason,
      }))
    );
  }

  return NextResponse.json({ orderId: order?.id, itemCount: items.length, total, reasoning });
}
