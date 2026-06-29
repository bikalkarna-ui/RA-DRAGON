import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { message, history = [] } = await request.json();
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    // Get store
    const { data: store } = await sb.from('stores').select('*').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found' }, { status: 400 });

    // Gather business context
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [
      { data: todayReport },
      { data: recentReports },
      { data: lowStock },
      { data: recentInvoices },
      { data: products },
    ] = await Promise.all([
      sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle(),
      sb.from('daily_reports').select('*').eq('store_id', store.id).gte('report_date', thirtyDaysAgo).order('report_date', { ascending: false }).limit(30),
      sb.from('products').select('name,quantity,min_quantity,unit_price,unit_cost,vendor_company,department').eq('store_id', store.id).eq('is_active', true).lte('quantity', 5).order('quantity').limit(20),
      sb.from('invoices').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(10),
      sb.from('products').select('name,quantity,unit_price,unit_cost,vendor_company,department').eq('store_id', store.id).eq('is_active', true).order('name').limit(100),
    ]);

    const n = (v: any) => Number(v || 0);
    const totalSales30 = (recentReports || []).reduce((s: number, r: any) => s + n(r.gross_sales), 0);
    const avgDaily = recentReports?.length ? totalSales30 / recentReports.length : 0;

    const context = `
You are RA Dragon AI, the business assistant for ${store.name}.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

TODAY'S REPORT:
${todayReport ? `
- Gross Sales: $${n(todayReport.gross_sales).toFixed(2)}
- Net Sales: $${n(todayReport.net_sales).toFixed(2)}
- Cash: $${n(todayReport.cash_sales).toFixed(2)}
- Credit: $${n(todayReport.credit_sales).toFixed(2)}
- Debit: $${n(todayReport.debit_sales).toFixed(2)}
- EBT: $${n(todayReport.ebt_sales).toFixed(2)}
- Lottery: $${n(todayReport.lottery_sales).toFixed(2)}
- Fuel: $${n(todayReport.fuel_sales).toFixed(2)}
- Short/Over: $${n(todayReport.drawer_difference).toFixed(2)}
- Safe Drops: $${n(todayReport.safe_drops).toFixed(2)}
- Paid Outs: $${n(todayReport.paid_outs).toFixed(2)}
` : 'No report uploaded today yet.'}

30-DAY AVERAGES:
- Average Daily Sales: $${avgDaily.toFixed(2)}
- Total 30-Day Sales: $${totalSales30.toFixed(2)}
- Days reported: ${recentReports?.length || 0}

LOW STOCK ITEMS (${lowStock?.length || 0} items):
${(lowStock || []).slice(0, 10).map((p: any) => `- ${p.name}: ${p.quantity} units left (vendor: ${p.vendor_company || 'unknown'})`).join('\n')}

RECENT INVOICES:
${(recentInvoices || []).slice(0, 5).map((inv: any) => `- ${inv.vendor_name || 'Unknown'}: $${n(inv.total_amount).toFixed(2)} - ${inv.status}`).join('\n')}

INVENTORY: ${products?.length || 0} active products
Total inventory value: $${(products || []).reduce((s: number, p: any) => s + n(p.unit_cost) * n(p.quantity), 0).toFixed(2)}

Answer questions about this store's business data. Be concise, specific, and helpful.
If asked about numbers, always use the actual data above.
If data is missing, say so clearly.
Format currency as $X.XX.
Keep responses short and actionable.`;

    const messages = [
      ...history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [
          { role: 'system', content: context },
          ...messages,
        ],
      }),
    });

    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? 'I could not process that request.';

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
