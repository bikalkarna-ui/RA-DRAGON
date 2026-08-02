import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveStore } from '@/lib/get-store';

// Pulls "what did I order recently" from every place an order can come from:
//  - invoice_items   (scanned vendor invoices, via Invoices module)
//  - purchase_order_items (AI Ordering / manual purchase orders)
//  - manual_orders   (quick log for orders that never get a scanned invoice)
// and cross-references against current low-stock products.

export async function GET(req: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const storeId = req.nextUrl.searchParams.get('store_id');
    const days = parseInt(req.nextUrl.searchParams.get('days') || '7', 10);
    const { store, error: storeErr } = await getActiveStore(sb, user.id, storeId);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const sinceDate = since.slice(0, 10);

    const [invoicesRes, poRes, manualRes, productsRes] = await Promise.all([
      sb.from('invoices')
        .select('id,vendor_name,invoice_date,created_at,invoice_items(id,raw_description,matched_name,quantity,unit_cost,product_id)')
        .eq('store_id', store.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      sb.from('purchase_orders')
        .select('id,vendor_name,created_at,purchase_order_items(id,product_name,department,order_qty,unit_cost,product_id)')
        .eq('store_id', store.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      sb.from('manual_orders')
        .select('*')
        .eq('store_id', store.id)
        .gte('order_date', sinceDate)
        .order('order_date', { ascending: false }),
      sb.from('products')
        .select('id,name,department,quantity,min_quantity')
        .eq('store_id', store.id)
        .eq('is_active', true),
    ]);

    if (invoicesRes.error) return NextResponse.json({ error: invoicesRes.error.message }, { status: 500 });
    if (poRes.error) return NextResponse.json({ error: poRes.error.message }, { status: 500 });
    if (manualRes.error) return NextResponse.json({ error: manualRes.error.message }, { status: 500 });
    if (productsRes.error) return NextResponse.json({ error: productsRes.error.message }, { status: 500 });

    const products = productsRes.data ?? [];
    const productById: Record<string, any> = {};
    products.forEach(p => { productById[p.id] = p; });

    type Line = {
      id: string; item: string; department: string | null; qty: number;
      unit_cost: number | null; date: string; vendor: string | null;
      source: 'invoice' | 'purchase_order' | 'manual'; product_id: string | null;
    };
    const lines: Line[] = [];

    (invoicesRes.data ?? []).forEach((inv: any) => {
      const date = inv.invoice_date || inv.created_at;
      (inv.invoice_items ?? []).forEach((it: any) => {
        const prod = it.product_id ? productById[it.product_id] : null;
        lines.push({
          id: it.id, item: it.matched_name || it.raw_description, department: prod?.department ?? null,
          qty: Number(it.quantity || 0), unit_cost: it.unit_cost ?? null, date,
          vendor: inv.vendor_name, source: 'invoice', product_id: it.product_id,
        });
      });
    });

    (poRes.data ?? []).forEach((po: any) => {
      (po.purchase_order_items ?? []).forEach((it: any) => {
        lines.push({
          id: it.id, item: it.product_name, department: it.department ?? null,
          qty: Number(it.order_qty || 0), unit_cost: it.unit_cost ?? null, date: po.created_at,
          vendor: po.vendor_name, source: 'purchase_order', product_id: it.product_id,
        });
      });
    });

    (manualRes.data ?? []).forEach((m: any) => {
      lines.push({
        id: m.id, item: m.item_name, department: m.department ?? null, qty: Number(m.qty || 0),
        unit_cost: m.unit_cost ?? null, date: m.order_date, vendor: m.vendor_name ?? null,
        source: 'manual', product_id: null,
      });
    });

    lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by department for the UI
    const grouped: Record<string, Line[]> = {};
    lines.forEach(l => {
      const key = l.department || 'Uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(l);
    });

    // Low-stock cross-reference: which low-stock products were NOT ordered in this window
    const orderedProductIds = new Set(lines.map(l => l.product_id).filter(Boolean));
    const lowStock = products.filter(p => Number(p.quantity) <= Number(p.min_quantity));
    const needsReorder = lowStock.filter(p => !orderedProductIds.has(p.id));
    const orderedButStillLow = lowStock.filter(p => orderedProductIds.has(p.id));

    return NextResponse.json({
      days, grouped, total: lines.length,
      needsReorder: needsReorder.map(p => ({ id: p.id, name: p.name, department: p.department, quantity: p.quantity, min_quantity: p.min_quantity })),
      orderedButStillLow: orderedButStillLow.map(p => ({ id: p.id, name: p.name, department: p.department, quantity: p.quantity, min_quantity: p.min_quantity })),
    });
  } catch (err: any) {
    console.error('order-history GET threw:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { store_id, item_name, department, qty, unit_cost, vendor_name, order_date, notes } = body;
    if (!item_name || !qty) return NextResponse.json({ error: 'item_name and qty are required' }, { status: 400 });

    const { store, error: storeErr } = await getActiveStore(sb, user.id, store_id);
    if (!store) return NextResponse.json({ error: storeErr || 'No store' }, { status: 400 });

    const { data, error } = await sb.from('manual_orders').insert({
      store_id: store.id,
      item_name,
      department: department || null,
      qty: Number(qty) || 0,
      unit_cost: unit_cost != null && unit_cost !== '' ? Number(unit_cost) : null,
      vendor_name: vendor_name || null,
      order_date: order_date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      created_by: user.id,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ order: data });
  } catch (err: any) {
    console.error('order-history POST threw:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
