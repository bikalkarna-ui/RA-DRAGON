import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { vendor_name, vendor_company } = await request.json();
    const apiKey = process.env.OPENROUTER_API_KEY;

    // Get products for this vendor
    const { data: products } = await sb.from('products').select('id,name,barcode,sku,department,quantity,min_quantity,max_quantity,unit_cost,unit_price,case_pack,reorder_qty').eq('store_id', store.id).eq('is_active', true).eq('vendor_company', vendor_name);

    if (!products?.length) return NextResponse.json({ error: `No products assigned to ${vendor_name}` }, { status: 400 });

    // Get 90-day movement data for velocity
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

    const productIds = products.map(p => p.id);
    const { data: movements90 } = await sb.from('inventory_movements').select('product_id,quantity,created_at').in('product_id', productIds).eq('type', 'sale').gte('created_at', d90);

    // Calculate velocities
    const velocityMap = new Map<string, { v30: number; v60: number; v90: number }>();
    for (const p of products) {
      const mv = (movements90 ?? []).filter(m => m.product_id === p.id);
      const v90 = Math.abs(mv.reduce((s, m) => s + Number(m.quantity), 0));
      const v60 = Math.abs(mv.filter(m => m.created_at >= d60).reduce((s, m) => s + Number(m.quantity), 0));
      const v30 = Math.abs(mv.filter(m => m.created_at >= d30).reduce((s, m) => s + Number(m.quantity), 0));
      velocityMap.set(p.id, { v30, v60, v90 });
    }

    const productData = products.map(p => {
      const v = velocityMap.get(p.id) ?? { v30: 0, v60: 0, v90: 0 };
      const dailySales = v.v30 / 30;
      const daysLeft = dailySales > 0 ? Math.round(p.quantity / dailySales) : 999;
      return { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, department: p.department, currentStock: p.quantity, minQty: p.min_quantity, maxQty: p.max_quantity, casePack: p.case_pack || 1, reorderQty: p.reorder_qty, unitCost: p.unit_cost, retailPrice: p.unit_price, v30: v.v30, v60: v.v60, v90: v.v90, daysLeft };
    });

    let orderItems: any[] = [];
    let aiNotes = '';

    if (apiKey) {
      const prompt = `You are an expert gas station inventory manager. Analyze these products for ${vendor_name} and create an optimal purchase order.

Products data (JSON): ${JSON.stringify(productData.slice(0, 30))}

Consider:
- v30/v60/v90 = units sold in 30/60/90 days
- daysLeft = days of inventory remaining at current rate
- Order enough for 14-21 days, rounded to case packs
- Skip items with daysLeft > 30 unless below minimum
- Flag slow movers (v90 < 5)
- Flag fast movers (v30 > v60/2)

Return ONLY valid JSON:
{"ai_notes":"brief summary","items":[{"product_id":"uuid","order_qty":0,"cases":0,"reason":"why","priority":"high|medium|low|skip","days_of_supply":0}]}`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      });

      if (res.ok) {
        const d = await res.json();
        const text = d?.choices?.[0]?.message?.content ?? '';
        try {
          const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim());
          aiNotes = parsed.ai_notes ?? '';
          orderItems = parsed.items ?? [];
        } catch { /* fallback below */ }
      }
    }

    // Fallback: rule-based ordering
    if (!orderItems.length) {
      orderItems = productData.filter(p => p.daysLeft < 14 || p.currentStock <= p.minQty).map(p => ({
        product_id: p.id, order_qty: Math.max(p.reorderQty || p.minQty * 2, Math.ceil(p.v30 * 0.75)),
        cases: Math.ceil(Math.max(p.reorderQty || p.minQty * 2, Math.ceil(p.v30 * 0.75)) / (p.casePack || 1)),
        reason: p.currentStock === 0 ? 'Out of stock' : p.daysLeft < 7 ? `Only ${p.daysLeft} days left` : 'Below minimum',
        priority: p.currentStock === 0 ? 'high' : p.daysLeft < 7 ? 'high' : 'medium',
        days_of_supply: 14,
      }));
    }

    // Build PO
    const poItems = orderItems.filter(i => i.priority !== 'skip').map(i => {
      const p = productData.find(x => x.id === i.product_id);
      if (!p) return null;
      const v = velocityMap.get(p.id) ?? { v30: 0, v60: 0, v90: 0 };
      return {
        product_id: p.id, product_name: p.name, barcode: p.barcode, sku: p.sku, department: p.department,
        current_stock: p.currentStock, order_qty: i.order_qty, received_qty: 0,
        case_pack: p.casePack, unit_cost: p.unitCost, retail_price: p.retailPrice,
        line_total: i.order_qty * p.unitCost,
        days_of_supply: i.days_of_supply ?? 14,
        velocity_30d: v.v30, velocity_60d: v.v60, velocity_90d: v.v90,
        ai_reason: i.reason, status: 'pending',
      };
    }).filter(Boolean);

    const total = poItems.reduce((s, i) => s + (i?.line_total ?? 0), 0);

    const { data: po, error: poErr } = await sb.from('purchase_orders').insert({
      store_id: store.id, vendor_name, vendor_company: vendor_company ?? vendor_name,
      status: 'draft', ai_generated: !!apiKey, ai_notes: aiNotes,
      total, subtotal: total, tax: 0,
    }).select('id').single();

    if (poErr) throw poErr;

    if (poItems.length) {
      await sb.from('purchase_order_items').insert(poItems.map(i => ({ ...i, order_id: po!.id })));
    }

    return NextResponse.json({ success: true, orderId: po?.id, itemCount: poItems.length, total, aiNotes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ orders: [] });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ orders: [] });

    const { data } = await sb.from('purchase_orders').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ orders: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ orders: [], error: err.message });
  }
}
