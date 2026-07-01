import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

// ── Date normalization — handles ANY format AI might return ──────────────────
function toDate(raw: any, fallback: string): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    // MM/DD/YYYY or MM/DD/YY
    const a = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (a) { const y = a[3].length===2?'20'+a[3]:a[3]; return `${y}-${a[1].padStart(2,'0')}-${a[2].padStart(2,'0')}`; }
    // "Jun 29 2026" or "June 29, 2026"
    const M: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const b = s.match(/([a-z]{3})\w*\s+(\d{1,2})[,\s]+(\d{4})/i);
    if (b) { const mn=M[b[1].toLowerCase()]; if(mn) return `${b[3]}-${mn}-${b[2].padStart(2,'0')}`; }
    const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return fallback;
}

// ── Safe number — returns 0 for anything that isn't a real positive-ish number ─
function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

// ── Call AI — send ALL images in one call, get one JSON back ─────────────────
async function callAI(images: { b64: string; mime: string }[], apiKey: string): Promise<any> {
  const content: any[] = [{
    type: 'text',
    text: `You are reading gas station close reports. There may be multiple images — read ALL of them.
Extract every number you can see. Return ONLY this JSON (no markdown, no explanation):

{"report_type":"store_close","report_date":null,"gross_sales":null,"fuel_sales":null,"inside_sales":null,"non_fuel_sales":null,"taxes":null,"discounts":null,"refunds":null,"transactions":null,"cash_sales":null,"credit_sales":null,"debit_sales":null,"ebt_sales":null,"check_sales":null,"crind_credit":null,"crind_debit":null,"crind_cash":null,"safe_drops":null,"paid_outs":null,"paid_ins":null,"safe_loans":null,"beginning_till":null,"ending_till":null,"expected_cash":null,"actual_cash":null,"cashier_short":null,"lottery_sales":null,"scratch_sales":null,"lottery_payouts":null,"scratch_payouts":null,"lottery_settlements":null,"lottery_commissions":null,"fuel_unleaded_sales":null,"fuel_midgrade_sales":null,"fuel_premium_sales":null,"fuel_diesel_sales":null,"fuel_unleaded_gallons":null,"fuel_midgrade_gallons":null,"fuel_premium_gallons":null,"fuel_diesel_gallons":null,"department_sales":{}}

RULES:
- report_date: ALWAYS output as YYYY-MM-DD. Examples: "Jun 29 2026" → "2026-06-29", "06/29/26" → "2026-06-29", "6/28/2026" → "2026-06-28"
- report_type: store_close | till | lottery | scratch | department | safe_drop | paid_out | fuel_atg | handwritten | unknown
- gross_sales: the LARGEST total — "Grand Total Store Sales Reading" or "Total Sales" or "Total Revenue"
- fuel_sales: "Total Fuel Sales" line
- inside_sales: "Non Fuel Sales" line  
- cash_sales: ONLY the "Cash" row in Method of Payment (NOT Cash Acceptor, NOT CRIND)
- crind_cash: "Cash Acceptor Cash" or "Cash Accpt Chg Due" rows
- crind_credit: "CRIND CR Local Acct" or "Crind CREDIT" rows
- check_sales: "Check" row
- beginning_till: "TILL BEGINNING BALANCE" from till tape
- cashier_short: "CASHIER SHORT AMOUNT" from till tape (always positive)
- lottery_settlements: "SETTLEMENTS" line on lottery report
- lottery_commissions: "COMMISSIONS" line
- scratch_payouts: "SCRATCH CASHES" line (ignore the minus sign, store as positive)
- department_sales: object like {"BEER":875.66,"SNACK":439.49} using Gross Sales $ column
- Use null for fields not visible. Never calculate. Never guess.`
  }];

  for (const img of images) {
    if (img.mime === 'application/pdf') {
      content.push({ type: 'file', file: { filename: 'report.pdf', file_data: `data:application/pdf;base64,${img.b64}` } });
    } else {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } });
    }
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  let raw = (data?.choices?.[0]?.message?.content ?? '').trim()
    .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  // Find JSON object
  const match = raw.match(/\{[\s\S]*/);
  if (!match) throw new Error(`No JSON in response: ${raw.slice(0,200)}`);
  let js = match[0];

  // Try parse as-is
  try { return JSON.parse(js); } catch {}

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
  try { return JSON.parse(js); } catch {}

  // Last resort — remove last incomplete key-value
  const clean = js.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '') + '}';
  try { return JSON.parse(clean); } catch { throw new Error(`JSON parse failed after recovery attempt`); }
}

// ── Smart Short/Over — POS is ground truth, not the employee ────────────────
function calcShortOver(r: any) {
  const n = toNum;
  const beginningTill = n(r.beginning_till);
  const cashSales     = n(r.cash_sales);
  const safeDrops     = n(r.safe_drops);
  const paidOuts      = n(r.paid_outs);
  const paidIns       = n(r.paid_ins);
  const safeLoans     = n(r.safe_loans);
  const actualCash    = n(r.actual_cash);
  const cashierShort  = n(r.cashier_short);
  const grossSales    = n(r.gross_sales);
  const creditSales   = n(r.credit_sales) + n(r.crind_credit);
  const debitSales    = n(r.debit_sales)  + n(r.crind_debit);
  const ebtSales      = n(r.ebt_sales);
  const checkSales    = n(r.check_sales);
  const crindCash     = n(r.crind_cash);

  // Step 1: Calculate expected cash from POS Store Close (ground truth)
  let expectedCash = n(r.expected_cash);
  if (!expectedCash) {
    if (cashSales > 0 || beginningTill > 0) {
      // Direct from POS cash flow
      expectedCash = beginningTill + cashSales - safeDrops - paidOuts + paidIns + safeLoans;
    } else if (grossSales > 0 && (creditSales + debitSales + checkSales + crindCash) > 0) {
      // Estimate cash: gross minus all non-cash
      const nonCash = creditSales + debitSales + ebtSales + checkSales + crindCash;
      const estCash = Math.max(0, grossSales - nonCash);
      expectedCash = beginningTill + estCash - safeDrops - paidOuts + paidIns + safeLoans;
    }
  }

  // Step 2: Short/Over
  let shortOver = 0;
  if (cashierShort > 0) {
    // POS itself calculated the short — most reliable
    shortOver = -cashierShort;
    if (!expectedCash && beginningTill > 0) expectedCash = beginningTill + cashierShort;
  } else if (actualCash > 0 && expectedCash > 0) {
    shortOver = actualCash - expectedCash;
  }
  // If no actual cash yet — shortOver stays 0 (will be set when employee counts)

  return { shortOver: Math.round(shortOver * 100) / 100, expectedCash };
}

// ── Build AI reason for short/over ──────────────────────────────────────────
async function getAIReason(report: any, shortOver: number, expectedCash: number, apiKey: string): Promise<string> {
  if (Math.abs(shortOver) < 0.50) return '';
  try {
    const isShort = shortOver < 0;
    const prompt = `Gas station daily report analysis:
- Gross Sales: $${toNum(report.gross_sales).toFixed(2)}
- Cash Sales (POS): $${toNum(report.cash_sales).toFixed(2)}
- Beginning Till: $${toNum(report.beginning_till).toFixed(2)}
- Safe Drops: $${toNum(report.safe_drops).toFixed(2)}
- Paid Outs: $${toNum(report.paid_outs).toFixed(2)}
- Paid Ins: $${toNum(report.paid_ins).toFixed(2)}
- Expected in drawer: $${expectedCash.toFixed(2)}
- Cashier short from POS: $${toNum(report.cashier_short).toFixed(2)}
- Drawer is ${isShort ? 'SHORT' : 'OVER'} by $${Math.abs(shortOver).toFixed(2)}

Give a 2-sentence explanation of the most likely reason for this ${isShort ? 'shortage' : 'overage'} at a gas station. Be specific and practical. No fluff.`;

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
    });
    const d = await res.json();
    return (d?.choices?.[0]?.message?.content || '').trim();
  } catch { return ''; }
}

// ── Merge extracted data with existing report ────────────────────────────────
function merge(existing: any, u: any): any {
  const n = toNum;
  const keep = (f: string) => n(existing?.[f]) || n(u[f]);
  const sum  = (f: string) => n(existing?.[f]) + n(u[f]);
  const t = (u.report_type || 'unknown').toLowerCase();

  if (t === 'store_close') return {
    ...existing,
    gross_sales:          n(u.gross_sales) || n(existing?.gross_sales),
    fuel_sales:           keep('fuel_sales'),
    inside_sales:         n(u.inside_sales) || n(u.non_fuel_sales) || n(existing?.inside_sales),
    taxes:                keep('taxes'), discounts: keep('discounts'), refunds: keep('refunds'),
    transactions:         keep('transactions'),
    cash_sales:           n(u.cash_sales) || n(existing?.cash_sales),
    credit_sales:         n(u.credit_sales) + n(u.crind_credit) || n(existing?.credit_sales),
    debit_sales:          n(u.debit_sales)  + n(u.crind_debit)  || n(existing?.debit_sales),
    ebt_sales:            keep('ebt_sales'), check_sales: keep('check_sales'),
    atm_sales:            n(u.crind_cash) || n(existing?.atm_sales),
    fuel_unleaded_sales:  keep('fuel_unleaded_sales'), fuel_midgrade_sales: keep('fuel_midgrade_sales'),
    fuel_premium_sales:   keep('fuel_premium_sales'),  fuel_diesel_sales:   keep('fuel_diesel_sales'),
    fuel_unleaded_gallons:keep('fuel_unleaded_gallons'),fuel_midgrade_gallons:keep('fuel_midgrade_gallons'),
    fuel_premium_gallons: keep('fuel_premium_gallons'), fuel_diesel_gallons: keep('fuel_diesel_gallons'),
  };

  if (t === 'till') return {
    ...existing,
    cash_sales:     n(u.cash_sales) || n(existing?.cash_sales),
    credit_sales:   n(u.credit_sales) + n(existing?.credit_sales),
    debit_sales:    n(u.debit_sales)  + n(existing?.debit_sales),
    safe_drops:     sum('safe_drops'), paid_outs: sum('paid_outs'),
    paid_ins:       sum('paid_ins'),   safe_loans: sum('safe_loans'),
    beginning_till: n(u.beginning_till) || n(existing?.beginning_till),
    actual_cash:    n(u.actual_cash)    || n(existing?.actual_cash),
    expected_cash:  n(u.expected_cash)  || n(existing?.expected_cash),
    cashier_short:  n(u.cashier_short)  || n(existing?.cashier_short),
  };

  if (t === 'lottery') return {
    ...existing,
    lottery_sales:       n(u.lottery_sales) || n(existing?.lottery_sales),
    scratch_sales:       n(u.scratch_sales) || n(existing?.scratch_sales),
    lottery_payouts:     sum('lottery_payouts'),
    scratch_payouts:     n(u.scratch_payouts) || n(existing?.scratch_payouts),
    lottery_settlement:  n(u.lottery_settlements) || n(existing?.lottery_settlement),
    lottery_commission:  n(u.lottery_commissions) || n(existing?.lottery_commission),
  };

  if (t === 'scratch') return { ...existing, scratch_sales: sum('scratch_sales'), scratch_payouts: sum('scratch_payouts') };
  if (t === 'safe_drop') return { ...existing, safe_drops: sum('safe_drops') };
  if (t === 'paid_out')  return { ...existing, paid_outs:  sum('paid_outs') };
  if (t === 'paid_in')   return { ...existing, paid_ins:   sum('paid_ins') };
  if (t === 'department') return { ...existing, department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) } };

  // Unknown — pick up anything non-zero
  const m = { ...existing };
  for (const [k, v] of Object.entries(u)) {
    if (v !== null && v !== 0 && v !== '' && typeof v !== 'object' && !m[k]) (m as any)[k] = v;
  }
  if (u.department_sales && Object.keys(u.department_sales).length > 0)
    m.department_sales = { ...(existing?.department_sales||{}), ...(u.department_sales||{}) };
  return m;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set in Vercel' }, { status: 500 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found — complete Setup in Settings first' }, { status: 400 });

    const formData = await request.formData();
    const reportDateOverride = formData.get('report_date') as string;

    // Collect all uploaded files
    const files: File[] = [];
    for (const [, v] of formData.entries()) {
      if (v instanceof File && v.size > 0) files.push(v);
    }
    if (!files.length) return NextResponse.json({ error: 'No files received' }, { status: 400 });

    // Convert to base64
    const images = await Promise.all(files.map(async f => ({
      b64: Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: f.type || 'image/jpeg',
    })));

    // Extract with AI
    let extracted: any;
    try { extracted = await callAI(images, apiKey); }
    catch (e: any) { return NextResponse.json({ error: `AI extraction failed: ${e.message}` }, { status: 502 }); }

    const today = new Date().toISOString().split('T')[0];
    const reportDate = toDate(extracted.report_date, reportDateOverride || today);
    const reportType = (extracted.report_type || 'unknown').toLowerCase();

    // Save upload record safely
    let uploadId: string | null = null;
    try {
      const { data: up } = await sb.from('report_uploads').insert({
        store_id: store.id, report_date: reportDate, report_type: reportType,
        file_name: files.map(f => f.name || 'photo').join(', '),
        status: 'completed', raw_extraction: extracted,
        processed_at: new Date().toISOString(),
      }).select('id').single();
      uploadId = up?.id ?? null;
    } catch {}

    // Get existing report and merge
    const { data: existing } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
    const merged = merge(existing || {}, extracted);

    // Calculate short/over
    const { shortOver, expectedCash } = calcShortOver({ ...merged, ...extracted });

    // Get AI reason for short/over
    const aiReason = await getAIReason({ ...merged, ...extracted }, shortOver, expectedCash, apiKey);

    // Build safe payload — every field explicitly cast, none can fail Postgres type check
    const payload = {
      store_id:             store.id,
      report_date:          reportDate,
      status:               'in_progress' as const,
      gross_sales:          toNum(merged.gross_sales),
      net_sales:            toNum(merged.net_sales),
      fuel_sales:           toNum(merged.fuel_sales),
      inside_sales:         toNum(merged.inside_sales),
      merchandise_sales:    toNum(merged.merchandise_sales),
      lottery_sales:        toNum(merged.lottery_sales),
      scratch_sales:        toNum(merged.scratch_sales),
      lottery_payouts:      toNum(merged.lottery_payouts),
      scratch_payouts:      toNum(merged.scratch_payouts),
      lottery_settlement:   toNum(merged.lottery_settlement),
      lottery_commission:   toNum(merged.lottery_commission),
      taxes:                toNum(merged.taxes),
      discounts:            toNum(merged.discounts),
      refunds:              toNum(merged.refunds),
      transactions:         Math.round(toNum(merged.transactions)),
      customers:            Math.round(toNum(merged.customers)),
      cash_sales:           toNum(merged.cash_sales),
      credit_sales:         toNum(merged.credit_sales),
      debit_sales:          toNum(merged.debit_sales),
      ebt_sales:            toNum(merged.ebt_sales),
      check_sales:          toNum(merged.check_sales),
      money_order_sales:    toNum(merged.money_order_sales),
      atm_sales:            toNum(merged.atm_sales),
      safe_drops:           toNum(merged.safe_drops),
      safe_loans:           toNum(merged.safe_loans),
      paid_ins:             toNum(merged.paid_ins),
      paid_outs:            toNum(merged.paid_outs),
      beginning_till:       toNum(merged.beginning_till),
      ending_till:          toNum(merged.ending_till),
      expected_cash:        expectedCash,
      actual_cash:          toNum(merged.actual_cash),
      cash_deposit:         toNum(merged.cash_deposit),
      drawer_difference:    shortOver,
      fuel_unleaded_sales:  toNum(merged.fuel_unleaded_sales),
      fuel_midgrade_sales:  toNum(merged.fuel_midgrade_sales),
      fuel_premium_sales:   toNum(merged.fuel_premium_sales),
      fuel_diesel_sales:    toNum(merged.fuel_diesel_sales),
      fuel_unleaded_gallons:toNum(merged.fuel_unleaded_gallons),
      fuel_midgrade_gallons:toNum(merged.fuel_midgrade_gallons),
      fuel_premium_gallons: toNum(merged.fuel_premium_gallons),
      fuel_diesel_gallons:  toNum(merged.fuel_diesel_gallons),
      department_sales:     merged.department_sales || {},
      validation_warnings:  [],
      ai_validated:         true,
      ai_notes:             aiReason || null,
      updated_at:           new Date().toISOString(),
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
      success: true, report: savedReport,
      reportType, reportDate,
      shortOver, expectedCash,
      aiReason,
      needsCashCount: toNum(merged.actual_cash) === 0 && expectedCash > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
