import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { counted_cash, report_date } = await request.json();
    const abs = (v: any) => Math.abs(Number(v || 0));
    const counted = abs(counted_cash);
    const date = report_date || new Date().toISOString().split('T')[0];

    const { data: report } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', date).maybeSingle();

    if (!report) {
      return NextResponse.json({
        error: 'No report found for this date. Upload your till report first so the app knows the safe drop amount.'
      }, { status: 404 });
    }

    // SIMPLE LOGIC:
    // Safe drops (from till report) = total cash physically dropped into safe
    // You count what is in the safe
    // Short/Over = what you counted vs safe drops
    const safeDrops = abs(report.safe_drops);
    const paidOuts  = abs(report.paid_outs);
    const paidIns   = abs(report.paid_ins);

    // Expected in safe = safe drops (what should be there)
    // Note: paid outs reduce what cashier had, paid ins add to it
    // Safe drops already accounts for this since cashier drops AFTER paid outs
    // So expected = safe drops total
    const expected = safeDrops;

    if (expected === 0) {
      return NextResponse.json({
        error: 'No safe drop amount found. Upload your till report first — it shows the cashier safe drops total.'
      }, { status: 400 });
    }

    // Short/Over
    const shortOver = Math.round((counted - expected) * 100) / 100;
    const isShort = shortOver < -0.50;
    const isOver  = shortOver > 0.50;
    const isGood  = !isShort && !isOver;

    // AI explanation
    const apiKey = process.env.OPENROUTER_API_KEY!;
    let aiReason = '';
    let aiSuggestions: string[] = [];

    try {
      const prompt = `Gas station cash safe count:
- Cashier safe drops total (from till report): $${expected.toFixed(2)}
- Owner physically counted in safe: $${counted.toFixed(2)}
- Difference: ${shortOver >= 0 ? '+' : ''}$${shortOver.toFixed(2)} (${isShort ? 'SHORT' : isOver ? 'OVER' : 'BALANCED'})
- Paid outs: $${paidOuts.toFixed(2)}, Paid ins: $${paidIns.toFixed(2)}

${isGood
  ? 'Safe matches perfectly. One sentence confirmation.'
  : `Safe is ${isShort ? 'SHORT' : 'OVER'} by $${Math.abs(shortOver).toFixed(2)}. 
     Two sentences on most likely reason. Then 3 specific things to check.`}

JSON only: {"reason":"...","suggestions":["...","...","..."]}`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'anthropic/claude-haiku-4-5', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
      });
      const d = await res.json();
      const raw = (d?.choices?.[0]?.message?.content || '').replace(/```json\s*/i,'').replace(/```/g,'').trim();
      const p = JSON.parse(raw);
      aiReason = p.reason || '';
      aiSuggestions = p.suggestions || [];
    } catch {
      if (isGood) {
        aiReason = 'Safe matches perfectly — all cash accounted for.';
        aiSuggestions = [];
      } else if (isShort) {
        aiReason = `Safe is $${Math.abs(shortOver).toFixed(2)} short of the recorded safe drops. Cash was either not fully dropped or a drop amount was entered incorrectly.`;
        aiSuggestions = [
          'Verify all drop receipts match the amounts entered in the POS',
          'Check if a drop was made but not recorded in the system',
          'Count again — verify you did not include the beginning till ($250) in your count'
        ];
      } else {
        aiReason = `Safe has $${shortOver.toFixed(2)} more than recorded drops. Extra cash found beyond what was logged.`;
        aiSuggestions = [
          'Check if a safe drop was made but not entered in the POS system',
          'Verify the beginning till amount was not accidentally dropped into safe',
          'Check for any unrecorded paid ins'
        ];
      }
    }

    // Save result
    await sb.from('daily_reports').update({
      actual_cash: counted,
      expected_cash: expected,
      drawer_difference: shortOver,
      ai_notes: aiReason,
      updated_at: new Date().toISOString(),
    }).eq('id', report.id);

    return NextResponse.json({
      success: true,
      counted,
      expected,
      short_over: shortOver,
      safe_drops: safeDrops,
      status: isShort ? 'short' : isOver ? 'over' : 'balanced',
      ai_reason: aiReason,
      ai_suggestions: aiSuggestions,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
