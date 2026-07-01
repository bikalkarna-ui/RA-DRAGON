import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { counted_cash, report_date, report_id } = await request.json();
    const n = (v: any) => Number(v || 0);
    const countedAmount = n(counted_cash);
    const today = report_date || new Date().toISOString().split('T')[0];

    // Get the daily report for this date
    const { data: report } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id)
      .eq('report_date', today)
      .maybeSingle();

    if (!report) return NextResponse.json({ error: 'No report found for this date' }, { status: 404 });

    // Calculate expected cash from POS numbers (ground truth)
    const beginningTill = n(report.beginning_till);
    const cashSales     = n(report.cash_sales);
    const safeDrops     = n(report.safe_drops);
    const paidOuts      = n(report.paid_outs);
    const paidIns       = n(report.paid_ins);
    const safeLoans     = n(report.safe_loans);

    // POS expected = what SHOULD be in drawer per POS system
    let expectedCash = n(report.expected_cash);
    if (!expectedCash && (cashSales > 0 || beginningTill > 0)) {
      expectedCash = beginningTill + cashSales - safeDrops - paidOuts + paidIns + safeLoans;
    }

    // Short/Over = what employee counted vs what POS says should be there
    const shortOver = Math.round((countedAmount - expectedCash) * 100) / 100;
    const isShort = shortOver < -0.50;
    const isOver  = shortOver > 0.50;
    const isGood  = !isShort && !isOver;

    // Ask AI to explain the short/over
    const apiKey = process.env.OPENROUTER_API_KEY!;
    let aiReason = '';
    let aiSuggestions: string[] = [];

    try {
      const prompt = `A gas station cashier counted $${countedAmount.toFixed(2)} in the drawer.
The POS system says there should be $${expectedCash.toFixed(2)}.
The difference is ${shortOver >= 0 ? '+' : ''}$${shortOver.toFixed(2)} (${isShort ? 'SHORT' : isOver ? 'OVER' : 'BALANCED'}).

Store data:
- Beginning till: $${beginningTill.toFixed(2)}
- Cash sales per POS: $${cashSales.toFixed(2)}
- Safe drops: $${safeDrops.toFixed(2)}
- Paid outs: $${paidOuts.toFixed(2)}
- Paid ins: $${paidIns.toFixed(2)}

${isGood ? 'The drawer is balanced. Give a brief confirmation.' :
`Explain in 2-3 sentences why the drawer might be ${isShort ? 'short' : 'over'} by $${Math.abs(shortOver).toFixed(2)}.
Then give 3 specific actionable suggestions to investigate. Be direct and practical for a gas station owner.`}

Respond in JSON only: {"reason": "...", "suggestions": ["...", "...", "..."]}`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const aiData = await res.json();
      const raw = (aiData?.choices?.[0]?.message?.content || '').trim()
        .replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
      const parsed = JSON.parse(raw);
      aiReason = parsed.reason || '';
      aiSuggestions = parsed.suggestions || [];
    } catch { 
      aiReason = isGood ? 'Drawer is balanced.' :
        isShort ? `Drawer is $${Math.abs(shortOver).toFixed(2)} short. Check for missed safe drops, paid outs not recorded, or counting errors.` :
        `Drawer is $${shortOver.toFixed(2)} over. Check for duplicate paid in entries or miscounted cash.`;
    }

    // Update the report with the cash count result
    await sb.from('daily_reports').update({
      actual_cash: countedAmount,
      expected_cash: expectedCash,
      drawer_difference: shortOver,
      ai_notes: aiReason,
      updated_at: new Date().toISOString(),
    }).eq('id', report.id);

    return NextResponse.json({
      success: true,
      counted: countedAmount,
      expected: expectedCash,
      short_over: shortOver,
      status: isShort ? 'short' : isOver ? 'over' : 'balanced',
      ai_reason: aiReason,
      ai_suggestions: aiSuggestions,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
