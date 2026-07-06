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
    const countedAmount = abs(counted_cash);
    const today = report_date || new Date().toISOString().split('T')[0];

    const { data: report } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
    if (!report) return NextResponse.json({ error: 'No report found for this date. Upload your store close report first.' }, { status: 404 });

    // CORRECT LOGIC:
    // Safe drops = total cash dropped by cashiers = what SHOULD be in the safe
    // Beginning till stays in register - not counted here
    // Short/Over = what you physically counted vs what safe drops say should be there
    const safeDrops    = abs(report.safe_drops);
    const beginningTill = abs(report.beginning_till);
    const paidOuts     = abs(report.paid_outs);
    const paidIns      = abs(report.paid_ins);
    const safeLoans    = abs(report.safe_loans);
    const cashSales    = abs(report.cash_sales);
    const grossSales   = abs(report.gross_sales);
    const credit       = abs(report.credit_sales);
    const debit        = abs(report.debit_sales);
    const checks       = abs(report.check_sales);
    const ebt          = abs(report.ebt_sales);
    const crind        = abs(report.atm_sales);

    // What should be in safe:
    // Option A: Safe drops total (most accurate - use if available)
    // Option B: Cash sales - paid outs + paid ins (if no safe drops recorded)
    // Option C: Gross - all non-cash - paid outs + paid ins (if fuel station with CRIND)
    let expectedInSafe = 0;
    if (safeDrops > 0) {
      // Use safe drops directly - this is what was physically dropped
      expectedInSafe = safeDrops;
    } else if (cashSales > 0) {
      expectedInSafe = cashSales - paidOuts + paidIns + safeLoans;
    } else if (grossSales > 0) {
      // Fuel station: most cash is CRIND, estimate cash portion
      const nonCash = credit + debit + ebt + checks + crind;
      const estimatedCash = Math.max(0, grossSales - nonCash);
      expectedInSafe = estimatedCash - paidOuts + paidIns;
    }

    expectedInSafe = Math.round(expectedInSafe * 100) / 100;

    // Short/Over = what you counted vs what should be in safe
    const shortOver = Math.round((countedAmount - expectedInSafe) * 100) / 100;
    const isShort   = shortOver < -0.50;
    const isOver    = shortOver > 0.50;
    const isGood    = !isShort && !isOver;

    // AI analysis
    const apiKey = process.env.OPENROUTER_API_KEY!;
    let aiReason = '';
    let aiSuggestions: string[] = [];

    try {
      const prompt = `Gas station cash count:
Safe drops total (what should be in safe): $${expectedInSafe.toFixed(2)}
You counted physically: $${countedAmount.toFixed(2)}
Difference: ${shortOver >= 0 ? '+' : ''}$${shortOver.toFixed(2)} (${isShort ? 'SHORT' : isOver ? 'OVER' : 'BALANCED'})
Beginning till (stays in register, not counted): $${beginningTill.toFixed(2)}
Paid outs: $${paidOuts.toFixed(2)} | Paid ins: $${paidIns.toFixed(2)}

${isGood ? 'Cash matches perfectly. Give brief 1-sentence confirmation.' : `Cash is ${isShort ? 'SHORT' : 'OVER'} by $${Math.abs(shortOver).toFixed(2)}. Give 2 sentences on most likely reason at a gas station. Then list 3 specific things to investigate.`}

JSON only: {"reason":"...","suggestions":["...","...","..."]}`;

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'anthropic/claude-haiku-4-5', max_tokens: 350, messages: [{ role: 'user', content: prompt }] })
      });
      const d = await res.json();
      const raw = (d?.choices?.[0]?.message?.content || '').replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim();
      const p = JSON.parse(raw);
      aiReason = p.reason || '';
      aiSuggestions = p.suggestions || [];
    } catch {
      if (isGood) {
        aiReason = 'Safe matches perfectly — all cash accounted for.';
      } else if (isShort) {
        aiReason = `Safe is $${Math.abs(shortOver).toFixed(2)} short. Cash was either not fully dropped into the safe or a paid out was not recorded.`;
        aiSuggestions = ['Check if all safe drops were completed and amounts match receipts', 'Review paid out receipts — any unrecorded payments?', 'Verify cashier dropped beginning till separately from sales cash'];
      } else {
        aiReason = `Safe is $${shortOver.toFixed(2)} over. Extra cash found beyond what drops account for.`;
        aiSuggestions = ['Check if a paid in was not recorded in the system', 'Verify the beginning till amount is correct', 'Look for any deposit from previous shift not cleared'];
      }
    }

    // Save to report
    await sb.from('daily_reports').update({
      actual_cash: countedAmount,
      expected_cash: expectedInSafe,
      drawer_difference: shortOver,
      ai_notes: aiReason,
      updated_at: new Date().toISOString(),
    }).eq('id', report.id);

    return NextResponse.json({
      success: true,
      counted: countedAmount,
      expected: expectedInSafe,
      short_over: shortOver,
      status: isShort ? 'short' : isOver ? 'over' : 'balanced',
      ai_reason: aiReason,
      ai_suggestions: aiSuggestions,
      safeDrops,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
