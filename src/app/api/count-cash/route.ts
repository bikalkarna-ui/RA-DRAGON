import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { counted_cash, report_date, cash_sales: clientCashSales } = await request.json();
    const n = (v: any) => Number(v || 0);
    const countedAmount = n(counted_cash);
    const today = report_date || new Date().toISOString().split('T')[0];

    // Get the daily report
    const { data: report } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', today).maybeSingle();

    // POS cash sales = the ground truth
    // This is what the POS system says customers paid in cash
    const cashSales = n(clientCashSales) || n(report?.cash_sales);
    
    if (cashSales === 0 && !report) {
      return NextResponse.json({ error: 'No report found for this date — upload your store close report first' }, { status: 404 });
    }

    // Short/Over = what you counted vs what POS says
    const shortOver = Math.round((countedAmount - cashSales) * 100) / 100;
    const isShort   = shortOver < -0.50;
    const isOver    = shortOver > 0.50;
    const isGood    = !isShort && !isOver;

    // AI explains why
    const apiKey = process.env.OPENROUTER_API_KEY!;
    let aiReason = '';
    let aiSuggestions: string[] = [];

    try {
      const safeDrops = n(report?.safe_drops);
      const prompt = `Gas station cash count analysis:
- POS cash sales (ground truth): $${cashSales.toFixed(2)}
- Owner physically counted: $${countedAmount.toFixed(2)}  
- Difference: ${shortOver >= 0 ? '+' : ''}$${shortOver.toFixed(2)} (${isShort ? 'SHORT' : isOver ? 'OVER' : 'BALANCED'})
- Total safe drops recorded: $${safeDrops.toFixed(2)}
- Paid outs: $${n(report?.paid_outs).toFixed(2)}
- Paid ins: $${n(report?.paid_ins).toFixed(2)}

${isGood ? 'Cash matches POS. Give a brief positive confirmation in one sentence.' :
`The cash is ${isShort ? 'SHORT' : 'OVER'} by $${Math.abs(shortOver).toFixed(2)}.
Write 2 sentences explaining the most likely reason at a gas station.
Then list exactly 3 specific things to check. Be direct and practical.`}

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
      if (isGood) {
        aiReason = 'Cash matches POS records perfectly.';
      } else if (isShort) {
        aiReason = `Cash is $${Math.abs(shortOver).toFixed(2)} short. Most likely a safe drop was missed or cash was paid out without being recorded.`;
        aiSuggestions = [
          'Check if all safe drops were entered in the POS system',
          'Review paid out receipts — any unrecorded payments?',
          'Check if beginning till amount was accidentally removed'
        ];
      } else {
        aiReason = `Cash is $${shortOver.toFixed(2)} over. Extra cash found that wasn\'t accounted for in sales.`;
        aiSuggestions = [
          'Check for any unrecorded paid ins or safe loans',
          'Verify beginning till amount was not double-counted',
          'Look for any voided transactions that had cash taken'
        ];
      }
    }

    // Save result to report
    if (report) {
      await sb.from('daily_reports').update({
        actual_cash: countedAmount,
        expected_cash: cashSales,
        drawer_difference: shortOver,
        ai_notes: aiReason,
        updated_at: new Date().toISOString(),
      }).eq('id', report.id);
    }

    return NextResponse.json({
      success: true,
      counted: countedAmount,
      expected: cashSales,
      short_over: shortOver,
      status: isShort ? 'short' : isOver ? 'over' : 'balanced',
      ai_reason: aiReason,
      ai_suggestions: aiSuggestions,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
