import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

// Normalize any date format to YYYY-MM-DD
function normalizeDate(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    // Try direct ISO format first
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
    // Try MM/DD/YYYY or MM/DD/YY
    const mdy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      const [, m, d, y] = mdy;
      const year = y.length === 2 ? '20' + y : y;
      return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // Try "Jun 28, 2026" or "JUN 29 2026"
    const months: Record<string,string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const mname = raw.match(/(\w{3})\w*\s+(\d{1,2})[,\s]+(\d{4})/i);
    if (mname) {
      const [,mon,day,yr] = mname;
      const mn = months[mon.toLowerCase().slice(0,3)];
      if (mn) return `${yr}-${mn}-${day.padStart(2,'0')}`;
    }
    // Try parsing as Date
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return fallback;
}

async function callAI(images: { b64: string; type: string }[], apiKey: string): Promise<any> {
  const content: any[] = [
    {
      type: 'text',
      text: `You are reading gas station daily close reports. Extract numbers exactly as printed. Return ONLY raw JSON no markdown.

JSON template:
{"report_type":"store_close","report_date":null,"register_number":null,"operator_name":null,"gross_sales":null,"net_sales":null,"fuel_sales":null,"fuel_unleaded_sales":null,"fuel_midgrade_sales":null,"fuel_premium_sales":null,"fuel_diesel_sales":null,"fuel_unleaded_gallons":null,"fuel_midgrade_gallons":null,"fuel_premium_gallons":null,"fuel_diesel_gallons":null,"inside_sales":null,"non_fuel_sales":null,"lottery_sales":null,"scratch_sales":null,"lottery_payouts":null,"scratch_payouts":null,"lottery_settlements":null,"lottery_commissions":null,"lottery_balance":null,"taxes":null,"discounts":null,"refunds":null,"transactions":null,"cash_sales":null,"credit_sales":null,"debit_sales":null,"ebt_sales":null,"check_sales":null,"crind_credit":null,"crind_debit":null,"crind_cash":null,"money_order_sales":null,"safe_drops":null,"safe_loans":null,"paid_ins":null,"paid_outs":null,"beginning_till":null,"ending_till":null,"expected_cash":null,"actual_cash":null,"cash_deposit":null,"drawer_difference":null,"cashier_short":null,"delivery_gallons":null,"department_sales":{},"notes":""}

CRITICAL RULES FOR TEXACO/24 SEVEN MART STORE CLOSE FORMAT:
- report_type: store_close, till, lottery, scratch, department, safe_drop, paid_out, paid_in, fuel_atg, handwritten, tax, unknown
- report_date: YYYY-MM-DD only. "Jun 29 2026"=2026-06-29, "06/29/26"=2026-06-29
- gross_sales = "Grand Total Store Sales Reading" or "Total Sales" — the biggest total number
- fuel_sales = "Total Fuel Sales"
- inside_sales = "Non Fuel Sales" 
- taxes = "Total Taxes Collected"
- fuel_unleaded_sales = Grade 01 UNLEAD REG sales amount
- fuel_midgrade_sales = Grade 02 UNL SUP US sales amount  
- fuel_premium_sales = Grade 03 REG PLS sales amount
- fuel_diesel_sales = Grade 04 DIESEL sales amount
- fuel_unleaded_gallons = Grade 01 volume
- fuel_midgrade_gallons = Grade 02 volume
- fuel_premium_gallons = Grade 03 volume
- fuel_diesel_gallons = Grade 04 volume

FOR METHOD OF PAYMENT section in Store Close:
- cash_sales = row labeled exactly "Cash" (not Cash Acceptor, not CRIND Cash)
- crind_cash = "Cash Acceptor Cash" or "Cash Accpt" — pay at pump cash
- credit_sales = "Credit" row amount
- crind_credit = "CRIND CR Local Acct" or "Crind CREDIT" amount
- crind_debit = "Crind DEBIT" amount  
- check_sales = "Check" row amount
- debit_sales = "Debit" row amount
FOR TILL REPORT (register tape):
- beginning_till = "TILL BEGINNING BALANCE" — usually $250.00
- cashier_short = "CASHIER SHORT AMOUNT" (positive number even if drawer is short)
- credit_sales = Credit amount from CASHIER COUNTED section
- debit_sales = Debit amount from CASHIER COUNTED section

FOR TEXAS LOTTERY:
- lottery_sales = "DRAW GM GROSS SALES" or sum of all game sales
- scratch_payouts = "SCRATCH CASHES" amount (may show as negative like 650.00-)
- lottery_settlements = "SETTLEMENTS" amount
- lottery_commissions = "COMMISSIONS" amount  
- lottery_balance = "BALANCE" amount

Department sales: {"BEER":875.66,"SNACK":439.49,"TOBACCO":155.20} — use gross sales column
Use null for any field not visible. Never calculate.`
    }
  ];

  for (const img of images) {
    if (img.type === 'application/pdf') {
      content.push({ type: 'file', file: { filename: 'report.pdf', file_data: `data:application/pdf;base64,${img.b64}` } });
    } else {
      content.push({ type: 'image_url', image_url: { url: `data:${img.type};base64,${img.b64}` } });
    }
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0,200)}`);
  }
  const data = await res.json();
  const raw = (data?.choices?.[0]?.message?.content ?? '').trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  // Try to find and parse JSON - handle truncated responses
  const match = clean.match(/\{[\s\S]*/);
  if (!match) throw new Error(`No JSON in AI response. Got: ${clean.slice(0,200)}`);
  
  let jsonStr = match[0];
  
  // Try parsing as-is first
  try { return JSON.parse(jsonStr); } catch {}
  
  // If truncated, try to close it properly
  // Count unclosed braces and brackets
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (const ch of jsonStr) {
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"' && !escape) { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
  }
  
  // Close any open string and add missing closing braces
  if (inStr) jsonStr += '"';
  if (depth > 0) jsonStr += '}'.repeat(depth);
  
  try { return JSON.parse(jsonStr); }
  catch { 
    // Last resort: extract what we can with a simple approach
    const simple = jsonStr.replace(/,\s*["}]\s*$/, '') + '}';
    try { return JSON.parse(simple); }
    catch { throw new Error(`JSON parse failed after ${jsonStr.length} chars`); }
  }
}

function merge(existing: any, u: any): any {
  const n = (v: any) => Number(v || 0);
  const keep = (f: string) => n(existing[f]) || n(u[f]);
  const sum  = (f: string) => n(existing[f]) + n(u[f]);
  const t = u.report_type || 'unknown';

  if (t === 'store_close') {
    // Drawer difference: prefer handwritten value, else use extracted
    const drawerDiff = n(u.drawer_difference) || n(existing.drawer_difference);
    return {
      ...existing,
      gross_sales: n(u.gross_sales) || n(u.total_revenue) || n(existing.gross_sales),
      net_sales: keep('net_sales'),
      fuel_sales: n(u.fuel_sales) || n(existing.fuel_sales),
      fuel_unleaded_sales: keep('fuel_unleaded_sales'),
      fuel_midgrade_sales: keep('fuel_midgrade_sales'),
      fuel_premium_sales: keep('fuel_premium_sales'),
      fuel_diesel_sales: keep('fuel_diesel_sales'),
      fuel_unleaded_gallons: keep('fuel_unleaded_gallons'),
      fuel_midgrade_gallons: keep('fuel_midgrade_gallons'),
      fuel_premium_gallons: keep('fuel_premium_gallons'),
      fuel_diesel_gallons: keep('fuel_diesel_gallons'),
      inside_sales: n(u.non_fuel_sales) || n(u.inside_sales) || n(existing.inside_sales),
      merchandise_sales: keep('merchandise_sales'),
      taxes: keep('taxes'),
      discounts: keep('discounts'),
      refunds: keep('refunds'),
      transactions: keep('transactions'),
      // Cash: actual register cash only (not CRIND/pay-at-pump)
      cash_sales: n(u.cash_sales) || n(existing.cash_sales),
      // Credit: direct credit + CRIND credit combined
      credit_sales: (n(u.credit_sales) + n(u.crind_credit)) || n(existing.credit_sales),
      // Debit: direct debit + CRIND debit combined
      debit_sales: (n(u.debit_sales) + n(u.crind_debit)) || n(existing.debit_sales),
      ebt_sales: keep('ebt_sales'),
      check_sales: keep('check_sales'),
      // Store CRIND cash separately for reference
      atm_sales: n(u.crind_cash) || n(existing.atm_sales),
      crind_credit: keep('crind_credit'),
      crind_debit: keep('crind_debit'),
      // Drawer difference from handwritten note on report
      drawer_difference: drawerDiff,
    };
  }
  if (t === 'till') {
    // Till report: cashier_short = how much the drawer is short (always positive on receipt)
    // beginning_till = starting cash in drawer (usually $250)
    // actual_cash = what cashier physically counted
    // expected_cash = beginning_till + cash tendered during shift
    const tillBegin = n(u.beginning_till) || n(existing.beginning_till);
    const cashShort = n(u.cashier_short); // positive number = short
    const actualCounted = n(u.actual_cash) || tillBegin;
    const expectedCash = cashShort > 0 ? actualCounted + cashShort : n(u.expected_cash) || n(existing.expected_cash);
    const drawerDiff = cashShort > 0 ? -cashShort : (n(u.drawer_difference) || n(existing.drawer_difference));
    return {
      ...existing,
      cash_sales: n(u.cash_sales) || n(existing.cash_sales),
      credit_sales: n(u.credit_sales) + n(existing.credit_sales),
      debit_sales: n(u.debit_sales) + n(existing.debit_sales),
      ebt_sales: sum('ebt_sales'),
      safe_drops: sum('safe_drops'),
      paid_outs: sum('paid_outs'),
      paid_ins: sum('paid_ins'),
      beginning_till: tillBegin,
      actual_cash: actualCounted,
      expected_cash: expectedCash,
      drawer_difference: drawerDiff,
    };
  }
  if (t === 'lottery') {
    return {
      ...existing,
      lottery_sales: n(u.lottery_sales) || n(u.lottery_net_sales) || n(existing.lottery_sales),
      lottery_payouts: sum('lottery_payouts'),
      scratch_sales: keep('scratch_sales'),
      scratch_payouts: n(u.scratch_payouts) || n(existing.scratch_payouts),
      lottery_settlement: n(u.lottery_settlements) || n(existing.lottery_settlement),
      lottery_commission: n(u.lottery_commissions) || n(existing.lottery_commission),
    };
  }
  if (t === 'scratch') return { ...existing, scratch_sales: sum('scratch_sales'), scratch_payouts: sum('scratch_payouts') };
  if (t === 'safe_drop') return { ...existing, safe_drops: sum('safe_drops') };
  if (t === 'paid_out') return { ...existing, paid_outs: sum('paid_outs') };
  if (t === 'paid_in')  return { ...existing, paid_ins: sum('paid_ins') };
  if (t === 'fuel_atg') return {
    ...existing,
    fuel_total_gallons: n(u.delivery_gallons) || n(existing.fuel_total_gallons),
  };
  if (t === 'department') {
    return { ...existing, department_sales: { ...(existing.department_sales||{}), ...(u.department_sales||{}) } };
  }
  if (t === 'handwritten') {
    return {
      ...existing,
      safe_drops: sum('safe_drops'),
      paid_outs: sum('paid_outs'),
      check_sales: sum('check_sales'),
    };
  }
  // Unknown/tax/other — pick up any non-null fields
  const m = { ...existing };
  for (const [k, v] of Object.entries(u)) {
    if (v !== null && v !== 0 && typeof v !== 'object' && !['report_type','notes','report_date','register_number','operator_name','store_number'].includes(k) && !m[k]) {
      m[k] = v;
    }
  }
  if (u.department_sales && Object.keys(u.department_sales).length > 0) {
    m.department_sales = { ...(existing.department_sales||{}), ...(u.department_sales||{}) };
  }
  return m;
}

function validate(r: any): string[] {
  const w: string[] = [];
  const n = (v: any) => Number(v || 0);
  const exp = n(r.expected_cash) || n(r.cash_sales) - n(r.paid_outs) - n(r.safe_drops) + n(r.paid_ins);
  const act = n(r.actual_cash);
  if (act > 0 && exp > 0 && Math.abs(act - exp) > 100) {
    w.push(`Cash doesn't balance: expected $${exp.toFixed(2)}, actual $${act.toFixed(2)}`);
  }
  return w;
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set in Vercel environment variables' }, { status: 500 });

    const formData = await request.formData();
    const storeIdOverride = formData.get('store_id') as string;
    const reportDateOverride = formData.get('report_date') as string;

    // Get store
    let store: { id: string } | null = null;
    if (storeIdOverride) {
      const { data } = await sb.from('stores').select('id').eq('id', storeIdOverride).eq('owner_id', user.id).maybeSingle();
      store = data;
    }
    if (!store) {
      const { data } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
      store = data;
    }
    if (!store) return NextResponse.json({ error: 'No store found. Complete store setup in Settings first.' }, { status: 400 });

    // Collect files
    const files: File[] = [...(formData.getAll('file') as File[]).filter((f: File) => f.size > 0)];
    for (let i = 1; i <= 10; i++) {
      const f = formData.get(`file${i}`) as File | null;
      if (f && f.size > 0) files.push(f);
    }
    if (!files.length) return NextResponse.json({ error: 'No files received' }, { status: 400 });

    // Convert to base64
    const images: { b64: string; type: string }[] = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      images.push({ b64: buf.toString('base64'), type: file.type || 'image/jpeg' });
    }

    // AI extraction
    let extracted: any;
    try { extracted = await callAI(images, apiKey); }
    catch (e: any) { return NextResponse.json({ error: `AI extraction failed: ${e.message}` }, { status: 502 }); }

    const reportType = extracted.report_type || 'unknown';
    const today = new Date().toISOString().split('T')[0];
    const reportDate = normalizeDate(extracted.report_date, reportDateOverride || today);

    const n = (v: any) => Number(v || 0);

    // Save upload record safely
    let uploadId: string | null = null;
    try {
      const { data: uploadData } = await sb.from('report_uploads').insert({
        store_id: store.id,
        report_date: reportDate,
        report_type: reportType,
        file_name: files.map((f: File) => f.name || 'photo').join(', '),
        status: 'completed',
        raw_extraction: extracted,
        parsed_data: extracted,
        ai_notes: extracted.notes || null,
        processed_at: new Date().toISOString(),
      }).select('id').single();
      uploadId = uploadData?.id ?? null;
    } catch { /* table may not exist yet */ }

    // Get or create daily report
    const { data: existing } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
    const merged = merge(existing || {}, extracted);
    const warnings = validate(merged);

    // ── Smart Short/Over — POS is the truth, not the employee ────────────────
    //
    // The Store Close report is the OFFICIAL record from the POS system.
    // The employee cannot alter it. We use POS numbers as ground truth.
    //
    // HOW IT WORKS:
    // POS knows exactly: Cash Sales, Safe Drops, Paid Outs, Paid Ins, Beginning Till
    // Expected Cash in drawer = Beginning Till + Cash Sales - Safe Drops - Paid Outs + Paid Ins
    // If employee counts more or less = Short/Over
    //
    // If till report is also uploaded, we compare POS expected vs till actual.
    // If NO till report = we still show what SHOULD be in drawer from POS numbers.
    // Employee can't fake this because they didn't generate the Store Close report.

    const beginningTill = n(merged.beginning_till);
    const cashSales     = n(merged.cash_sales);
    const safeDrop      = n(merged.safe_drops);
    const paidOuts      = n(merged.paid_outs);
    const paidIns       = n(merged.paid_ins);
    const safeLoans     = n(merged.safe_loans);
    const grossSales    = n(merged.gross_sales);
    const creditSales   = n(merged.credit_sales);
    const debitSales    = n(merged.debit_sales);
    const ebtSales      = n(merged.ebt_sales);
    const checkSales    = n(merged.check_sales);
    const crindCash     = n(merged.crind_cash) || n(merged.atm_sales);
    const lottoPayouts  = n(merged.lottery_payouts) + n(merged.scratch_payouts);

    // Step 1: Calculate expected cash from POS Store Close numbers
    // This is what SHOULD be in the drawer — POS generated, employee cannot fake
    let expectedCash = n(merged.expected_cash);

    if (expectedCash === 0) {
      if (cashSales > 0 || beginningTill > 0) {
        // Store Close has cash sales — use directly
        expectedCash = beginningTill + cashSales - safeDrop - paidOuts + paidIns + safeLoans;
      } else if (grossSales > 0 && (creditSales + debitSales + checkSales + crindCash) > 0) {
        // No explicit cash_sales — estimate: gross minus all non-cash
        const nonCash = creditSales + debitSales + ebtSales + checkSales + crindCash + lottoPayouts;
        const estimatedCash = Math.max(0, grossSales - nonCash);
        expectedCash = beginningTill + estimatedCash - safeDrop - paidOuts + paidIns + safeLoans;
      }
    }

    // Step 2: Actual cash — what employee physically counted
    // Sources in priority order (all from reports, not employee claims):
    // a) Explicit actual_cash from till report
    // b) Beginning till (if cashier_short also provided, we can derive actual)
    const actualCash    = n(merged.actual_cash);
    const cashierShort  = n(merged.cashier_short); // from POS till tape — POS calculated this

    // Step 3: Calculate Short/Over
    let shortOver = 0;

    if (cashierShort > 0 && expectedCash > 0) {
      // POS till tape reported how much short — cross-check with our expected
      // Use POS-calculated short (more reliable than our estimate)
      shortOver = -cashierShort;
      // Override expected to be consistent: actual = expected + short
      if (actualCash === 0) {
        // Derive actual from POS expected and reported short
        // actual = expectedCash + shortOver (negative = they came up short)
      }
    } else if (actualCash > 0 && expectedCash > 0) {
      // Both known — straight calculation
      shortOver = actualCash - expectedCash;
    } else if (expectedCash > 0 && actualCash === 0) {
      // Only expected known (Store Close only, no till uploaded)
      // Can't calculate short/over yet — show 0 but show expected
      // Owner knows: expected is from POS, go check the drawer
      shortOver = 0;
    }

    // Round to cents
    shortOver = Math.round(shortOver * 100) / 100;

    const totalCredit = n(merged.credit_sales);
    const totalDebit  = n(merged.debit_sales);

    const payload: Record<string, any> = {
      store_id: store.id,
      report_date: reportDate,
      status: 'in_progress',
      gross_sales: n(merged.gross_sales) || n(merged.total_revenue),
      net_sales: n(merged.net_sales),
      fuel_sales: n(merged.fuel_sales),
      fuel_unleaded_sales: n(merged.fuel_unleaded_sales),
      fuel_midgrade_sales: n(merged.fuel_midgrade_sales),
      fuel_premium_sales: n(merged.fuel_premium_sales),
      fuel_diesel_sales: n(merged.fuel_diesel_sales),
      fuel_unleaded_gallons: n(merged.fuel_unleaded_gallons),
      fuel_midgrade_gallons: n(merged.fuel_midgrade_gallons),
      fuel_premium_gallons: n(merged.fuel_premium_gallons),
      fuel_diesel_gallons: n(merged.fuel_diesel_gallons),
      inside_sales: n(merged.inside_sales) || n(merged.non_fuel_sales),
      merchandise_sales: n(merged.merchandise_sales),
      lottery_sales: n(merged.lottery_sales) || n(merged.lottery_net_sales),
      scratch_sales: n(merged.scratch_sales),
      lottery_payouts: n(merged.lottery_payouts),
      scratch_payouts: n(merged.scratch_payouts),
      lottery_settlement: n(merged.lottery_settlement) || n(merged.lottery_settlements),
      lottery_commission: n(merged.lottery_commission) || n(merged.lottery_commissions),
      taxes: n(merged.taxes),
      discounts: n(merged.discounts),
      refunds: n(merged.refunds),
      transactions: n(merged.transactions),
      customers: n(merged.customers),
      cash_sales: n(merged.cash_sales),
      credit_sales: totalCredit,
      debit_sales: totalDebit,
      ebt_sales: n(merged.ebt_sales),
      check_sales: n(merged.check_sales),
      money_order_sales: n(merged.money_order_sales),
      atm_sales: n(merged.atm_amount),
      safe_drops: n(merged.safe_drops),
      safe_loans: n(merged.safe_loans),
      paid_ins: n(merged.paid_ins),
      paid_outs: n(merged.paid_outs),
      beginning_till: n(merged.beginning_till),
      ending_till: n(merged.ending_till),
      expected_cash: expectedCash,
      actual_cash: actualCash,
      cash_deposit: n(merged.cash_deposit),
      drawer_difference: shortOver,
      department_sales: merged.department_sales || {},
      validation_warnings: warnings,
      ai_validated: warnings.length === 0,
      ai_notes: [extracted.notes, extracted.operator_name ? `Operator: ${extracted.operator_name}` : null, extracted.store_number ? `Store #${extracted.store_number}` : null].filter(Boolean).join(' | ') || null,
      updated_at: new Date().toISOString(),
    };

    let savedReport: any = null;
    if (existing) {
      const { data } = await sb.from('daily_reports').update(payload).eq('id', existing.id).select('*').single();
      savedReport = data;
    } else {
      const { data } = await sb.from('daily_reports').insert(payload).select('*').single();
      savedReport = data;
    }

    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    return NextResponse.json({
      success: true,
      report: savedReport,
      reportType,
      reportDate,
      warnings,
      hasWarnings: warnings.length > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
