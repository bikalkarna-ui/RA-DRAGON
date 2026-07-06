import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ── Safe number conversion - handles ANY format ──────────────────────────────
function n(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  let s = String(v).replace(/[$,\s]/g, '').trim();
  const neg = s.startsWith('-') || s.startsWith('(') || s.endsWith('-');
  s = s.replace(/[^0-9.]/g, '');
  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.round((neg ? -num : num) * 100) / 100;
}

function abs(v: any): number { return Math.abs(n(v)); }

// ── Date normalization - handles ANY format, always returns YYYY-MM-DD ────────
function toDate(raw: any, fallback: string): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  // Already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    // MM/DD/YYYY or MM/DD/YY or MM-DD-YYYY
    const a = s.match(/(\d{1,2})[\/\-,](\d{1,2})[\/\-,](\d{2,4})/);
    if (a) {
      const y = a[3].length === 2 ? '20' + a[3] : a[3];
      return `${y}-${a[1].padStart(2,'0')}-${a[2].padStart(2,'0')}`;
    }
    // "Jun 30 2026" or "JUN30 2026" or "JUL01 2026"
    const MONTHS: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const b = s.match(/([a-z]{3})\w*[\s,]*(\d{1,2})[\s,]+(\d{4})/i);
    if (b) { const m = MONTHS[b[1].toLowerCase()]; if (m) return `${b[3]}-${m}-${b[2].padStart(2,'0')}`; }
    // "JUL012026" compact
    const c = s.match(/([a-z]{3})(\d{2})(\d{4})/i);
    if (c) { const m = MONTHS[c[1].toLowerCase()]; if (m) return `${c[3]}-${m}-${c[2]}`; }
    // Try native Date parser as last resort
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return fallback;
}

// ── Parse AI response - bulletproof JSON extraction ──────────────────────────
function parseAI(raw: string): any | null {
  if (!raw) return null;
  // Strip markdown
  let s = raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  // Find JSON start
  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);
  // Try as-is
  try { return JSON.parse(s); } catch {}
  // Count and close unclosed braces/brackets
  let depth = 0, inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) { if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') depth--; }
  }
  if (inStr) s += '"';
  while (depth > 0) { s += '}'; depth--; }
  try { return JSON.parse(s); } catch {}
  // Last resort: strip trailing incomplete key
  try { return JSON.parse(s.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '}').replace(/,\s*$/, '}')); } catch {}
  return null;
}

// ── Call AI with retry across models ─────────────────────────────────────────
async function callAI(images: {b64:string;mime:string}[], prompt: string, maxTokens: number, apiKey: string): Promise<any> {
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of images) {
    if (img.mime === 'application/pdf') {
      content.push({ type: 'file', file: { filename: 'report.pdf', file_data: `data:application/pdf;base64,${img.b64}` } });
    } else {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } });
    }
  }

  const MODELS = [
    'google/gemini-2.0-flash-001',
    'anthropic/claude-haiku-4-5',
    'openai/gpt-4o-mini',
  ];

  for (const model of MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseAI(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

// ── Merge new extraction into existing report data ────────────────────────────
function merge(existing: any, u: any): any {
  const t = (u.report_type || 'unknown').toLowerCase();
  const keep = (f: string) => abs(existing?.[f]) > 0 ? abs(existing[f]) : abs(u[f]);
  const add  = (f: string) => abs(existing?.[f]) + abs(u[f]);

  if (t === 'store_close') return {
    ...existing,
    gross_sales: abs(u.gross_sales) || abs(existing?.gross_sales),
    fuel_sales:  abs(u.fuel_sales)  || abs(existing?.fuel_sales),
    inside_sales: abs(u.non_fuel_sales) || abs(u.inside_sales) || abs(existing?.inside_sales),
    taxes:       abs(u.taxes) || abs(existing?.taxes),
    discounts:   abs(u.discounts) || abs(existing?.discounts),
    // CRIND CR Local Acct is the main credit at Texaco/24 Seven Mart
    credit_sales: (abs(u.crind_credit) + abs(u.credit_sales)) || abs(existing?.credit_sales),
    debit_sales:  (abs(u.crind_debit) + abs(u.debit_sales)) || abs(existing?.debit_sales),
    cash_sales:   abs(u.cash_sales) || abs(existing?.cash_sales),
    ebt_sales:    keep('ebt_sales'),
    check_sales:  abs(u.check_sales) || abs(existing?.check_sales),
    atm_sales:    abs(u.crind_cash) || abs(existing?.atm_sales),
    fuel_unleaded_sales:   keep('fuel_unleaded_sales'),
    fuel_midgrade_sales:   keep('fuel_midgrade_sales'),
    fuel_premium_sales:    keep('fuel_premium_sales'),
    fuel_diesel_sales:     keep('fuel_diesel_sales'),
    fuel_unleaded_gallons: keep('fuel_unleaded_gallons'),
    fuel_midgrade_gallons: keep('fuel_midgrade_gallons'),
    fuel_premium_gallons:  keep('fuel_premium_gallons'),
    fuel_diesel_gallons:   keep('fuel_diesel_gallons'),
    department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) },
    transactions: keep('transactions'),
    customers:    keep('customers'),
  };

  if (t === 'till') return {
    ...existing,
    beginning_till: abs(u.beginning_till) || abs(existing?.beginning_till),
    // Safe drops = all cash dropped (Cashier Safe Drops)
    safe_drops:   abs(u.safe_drops) + abs(existing?.safe_drops),
    safe_loans:   abs(u.safe_loans) + abs(existing?.safe_loans),
    paid_ins:     add('paid_ins'),
    paid_outs:    add('paid_outs'),
    // Accumulate short/over across all registers
    cashier_short: add('cashier_short'),
    cashier_over:  add('cashier_over'),
    credit_sales:  add('credit_sales'),
    debit_sales:   add('debit_sales'),
    cash_sales:    abs(u.cash_sales) || abs(existing?.cash_sales),
  };

  if (t === 'lottery') return {
    ...existing,
    lottery_sales:      abs(u.lottery_sales) || abs(existing?.lottery_sales),
    scratch_sales:      abs(u.scratch_sales) || abs(existing?.scratch_sales),
    scratch_payouts:    abs(u.scratch_payouts) || abs(existing?.scratch_payouts),
    lottery_settlement: abs(u.lottery_settlements) || abs(existing?.lottery_settlement),
    lottery_commission: abs(u.lottery_commissions) || abs(existing?.lottery_commission),
  };

  if (t === 'handwritten') return {
    ...existing,
    safe_drops: abs(u.safe_drops) || abs(existing?.safe_drops),
    paid_ins:   add('paid_ins'),
    paid_outs:  add('paid_outs'),
    checks_given: [...(existing?.checks_given||[]), ...(u.checks_given||[])],
    deliveries:   [...(existing?.deliveries||[]), ...(u.deliveries||[])],
  };

  if (t === 'department') return {
    ...existing,
    department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) },
  };

  // Generic fallback
  const merged = { ...existing };
  for (const [k,v] of Object.entries(u)) {
    if (v !== null && v !== 0 && typeof v !== 'object' && !['report_type','report_date'].includes(k) && !merged[k]) {
      (merged as any)[k] = v;
    }
  }
  if (u.department_sales && Object.keys(u.department_sales).length > 0)
    merged.department_sales = { ...(existing?.department_sales||{}), ...(u.department_sales||{}) };
  return merged;
}

// ── Short/Over calculation ─────────────────────────────────────────────────
// YOUR STORE LOGIC:
// Safe drops = all cash dropped by cashiers = what should be in the safe
// Beginning till ($250) stays in register - NOT counted as cash to deposit
// Short/Over = what you physically count vs total safe drops
//
// If till report has CASHIER SHORT/OVER: use that directly (POS calculated it)
// If only store close: safe_drops is the "expected" cash in the safe
function calcShortOver(r: any) {
  const cashierShort = abs(r.cashier_short);
  const cashierOver  = abs(r.cashier_over);
  const safeDrops    = abs(r.safe_drops);
  const beginningTill = abs(r.beginning_till);
  const paidOuts     = abs(r.paid_outs);
  const paidIns      = abs(r.paid_ins);
  const safeLoans    = abs(r.safe_loans);
  const cashSales    = abs(r.cash_sales);
  const grossSales   = abs(r.gross_sales);
  const creditSales  = abs(r.credit_sales);
  const debitSales   = abs(r.debit_sales);
  const checkSales   = abs(r.check_sales);
  const ebtSales     = abs(r.ebt_sales);
  const crindCash    = abs(r.atm_sales);

  // Method 1: Till tape has cashier short/over (most reliable - POS calculated)
  let shortOver = 0;
  if (cashierShort > 0 || cashierOver > 0) {
    shortOver = cashierOver - cashierShort; // positive = over, negative = short
  }

  // Expected = what SHOULD be in safe
  // = Safe drops (that's what was dropped, that's what should be there)
  // If no safe drops, estimate from cash flow
  let expectedInSafe = safeDrops;
  if (expectedInSafe === 0 && (cashSales > 0 || grossSales > 0)) {
    if (cashSales > 0) {
      // Calculate: Beginning till + cash sales - ending till - paid outs + paid ins
      expectedInSafe = cashSales - paidOuts + paidIns;
    } else {
      // Estimate cash: gross minus all non-cash
      const nonCash = creditSales + debitSales + ebtSales + checkSales + crindCash;
      expectedInSafe = Math.max(0, grossSales - nonCash) - paidOuts + paidIns;
    }
  }

  return {
    shortOver: Math.round(shortOver * 100) / 100,
    expectedInSafe: Math.round(expectedInSafe * 100) / 100,
    safeDrops,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in — please sign in again' }, { status: 401 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured — contact support' }, { status: 500 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found — complete store setup in Settings first' }, { status: 400 });

    const formData = await request.formData();
    const reportDateOverride = formData.get('report_date') as string;

    // Collect all files
    const files: File[] = [];
    for (const [, v] of formData.entries()) {
      if (v instanceof File && v.size > 0) files.push(v);
    }
    if (!files.length) return NextResponse.json({ error: 'No image received — please try again' }, { status: 400 });

    // Convert to base64
    const images = await Promise.all(files.map(async f => ({
      b64: Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: f.type || 'image/jpeg',
    })));

    const today = new Date().toISOString().split('T')[0];

    // ── TWO parallel AI calls for speed and reliability ───────────────────────
    const NUMERIC_PROMPT = `Gas station daily report reader. Read the image carefully.
Return ONLY raw JSON (no markdown, no explanation):
{"report_type":"store_close","report_date":null,"gross_sales":null,"fuel_sales":null,"non_fuel_sales":null,"taxes":null,"discounts":null,"fuel_unleaded_sales":null,"fuel_midgrade_sales":null,"fuel_premium_sales":null,"fuel_diesel_sales":null,"fuel_unleaded_gallons":null,"fuel_midgrade_gallons":null,"fuel_premium_gallons":null,"fuel_diesel_gallons":null,"cash_sales":null,"credit_sales":null,"debit_sales":null,"ebt_sales":null,"check_sales":null,"crind_credit":null,"crind_debit":null,"crind_cash":null,"safe_drops":null,"safe_loans":null,"paid_ins":null,"paid_outs":null,"beginning_till":null,"cashier_short":null,"cashier_over":null,"lottery_sales":null,"scratch_sales":null,"scratch_payouts":null,"lottery_settlements":null,"lottery_commissions":null,"refunds":null,"transactions":null,"customers":null}

FIELD GUIDE:
report_type: store_close|till|lottery|scratch|department|handwritten|unknown
report_date: YYYY-MM-DD format always (e.g. 2026-07-01, not Jul 1)
gross_sales: "Grand Total Store Sales Reading" or total sales number
fuel_sales: "Total Fuel Sales"
non_fuel_sales: "Non Fuel Sales" 
taxes: "Total Taxes Collected"
cash_sales: "Cash" row in payment methods (usually $0 at fuel stations)
crind_credit: "CRIND CR Local Acct" - the MAIN credit line (~$6000+)
credit_sales: "Credit" or "Credit Local Acct" row
crind_debit: "Crind DEBIT" row
debit_sales: "Debit" row  
check_sales: "Check" row (customer checks, NOT vendor checks)
crind_cash: "Cash Acceptor Cash" row
safe_drops: Total cashier safe drops cash amount
safe_loans: "Safe Loans" cash amount
paid_outs: Total paid outs (positive number)
paid_ins: Total paid ins
beginning_till: "TILL BEGINNING BALANCE"
cashier_short: "CASHIER SHORT AMOUNT" (positive)
cashier_over: "CASHIER OVER AMOUNT" (positive)
lottery_settlements: "SETTLEMENTS" on lottery report
lottery_commissions: "COMMISSIONS" (positive)
scratch_payouts: "SCRATCH CASHES" (positive, ignore minus sign)
All amounts: positive numbers only. null = not found.`;

    const LISTS_PROMPT = `Gas station report reader. Return ONLY raw JSON:
{"department_sales":{},"checks_given":[],"deliveries":[],"tickets_activated":[]}
department_sales: from Dept Sales report, Gross Sales column: {"BEER":820.51,"SNACK":895.47}
checks_given: vendor checks from handwritten daily report: [{"number":"4573","payee":"Tylers Ice","amount":829.00}]
deliveries: deliveries received: [{"vendor":"Pepsi","amount":681.61}]
tickets_activated: scratch tickets: [{"book":"2739","price":5}]
Empty arrays/objects if not found.`;

    const [numResult, listResult] = await Promise.all([
      callAI(images, NUMERIC_PROMPT, 800, apiKey),
      callAI(images, LISTS_PROMPT, 1500, apiKey),
    ]);

    if (!numResult) {
      return NextResponse.json({
        error: 'Could not read the report. Please try:\n• Better lighting\n• Hold camera steady\n• Make sure report is flat\n• Try uploading a photo instead of scanning'
      }, { status: 502 });
    }

    const extracted = {
      ...numResult,
      department_sales: listResult?.department_sales || {},
      checks_given: listResult?.checks_given || [],
      deliveries: listResult?.deliveries || [],
      tickets_activated: listResult?.tickets_activated || [],
    };

    const reportType = (extracted.report_type || 'unknown').toLowerCase();
    const reportDate = toDate(extracted.report_date, reportDateOverride || today);

    // Save upload record
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

    // Merge with existing report
    const { data: existing } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
    const merged = merge(existing || {}, extracted);

    // Calculate short/over
    const { shortOver, expectedInSafe, safeDrops } = calcShortOver(merged);

    // Build DB payload — every field sanitized, no type errors
    const payload: Record<string,any> = {
      store_id: store.id, report_date: reportDate, status: 'in_progress',
      gross_sales:           abs(merged.gross_sales),
      fuel_sales:            abs(merged.fuel_sales),
      inside_sales:          abs(merged.inside_sales) || abs(merged.non_fuel_sales),
      merchandise_sales:     abs(merged.merchandise_sales),
      lottery_sales:         abs(merged.lottery_sales),
      scratch_sales:         abs(merged.scratch_sales),
      lottery_payouts:       abs(merged.lottery_payouts),
      scratch_payouts:       abs(merged.scratch_payouts),
      lottery_settlement:    abs(merged.lottery_settlement) || abs(merged.lottery_settlements),
      lottery_commission:    abs(merged.lottery_commission) || abs(merged.lottery_commissions),
      taxes:                 abs(merged.taxes),
      discounts:             abs(merged.discounts),
      refunds:               abs(merged.refunds),
      transactions:          Math.round(abs(merged.transactions)),
      customers:             Math.round(abs(merged.customers)),
      cash_sales:            abs(merged.cash_sales),
      credit_sales:          abs(merged.credit_sales),
      debit_sales:           abs(merged.debit_sales),
      ebt_sales:             abs(merged.ebt_sales),
      check_sales:           abs(merged.check_sales),
      money_order_sales:     abs(merged.money_order_sales),
      atm_sales:             abs(merged.atm_sales),
      safe_drops:            abs(merged.safe_drops),
      safe_loans:            abs(merged.safe_loans),
      paid_ins:              abs(merged.paid_ins),
      paid_outs:             abs(merged.paid_outs),
      beginning_till:        abs(merged.beginning_till),
      ending_till:           abs(merged.ending_till),
      expected_cash:         expectedInSafe,  // what should be in safe
      actual_cash:           abs(merged.actual_cash),
      cash_deposit:          abs(merged.cash_deposit),
      drawer_difference:     shortOver,
      fuel_unleaded_sales:   abs(merged.fuel_unleaded_sales),
      fuel_midgrade_sales:   abs(merged.fuel_midgrade_sales),
      fuel_premium_sales:    abs(merged.fuel_premium_sales),
      fuel_diesel_sales:     abs(merged.fuel_diesel_sales),
      fuel_unleaded_gallons: abs(merged.fuel_unleaded_gallons),
      fuel_midgrade_gallons: abs(merged.fuel_midgrade_gallons),
      fuel_premium_gallons:  abs(merged.fuel_premium_gallons),
      fuel_diesel_gallons:   abs(merged.fuel_diesel_gallons),
      department_sales:      merged.department_sales || {},
      validation_warnings:   [],
      ai_validated:          true,
      ai_notes:              [
        (extracted.deliveries||[]).length > 0 ? `${extracted.deliveries.length} deliveries sent to Invoices` : null,
        (extracted.checks_given||[]).length > 0 ? `${extracted.checks_given.length} vendor checks recorded` : null,
      ].filter(Boolean).join(' · ') || null,
      updated_at: new Date().toISOString(),
    };

    let savedReport: any = null;
    if (existing) {
      const { data, error } = await sb.from('daily_reports').update(payload).eq('id', existing.id).select('*').single();
      if (error) return NextResponse.json({ error: `Could not save report: ${error.message}` }, { status: 500 });
      savedReport = data;
    } else {
      const { data, error } = await sb.from('daily_reports').insert(payload).select('*').single();
      if (error) return NextResponse.json({ error: `Could not save report: ${error.message}` }, { status: 500 });
      savedReport = data;
    }

    // Link upload
    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    // Auto-send deliveries to invoices
    for (const d of extracted.deliveries || []) {
      if (!d.vendor) continue;
      try { await sb.from('invoices').insert({ store_id: store.id, vendor_name: d.vendor, total_amount: abs(d.amount) || null, status: 'NEEDS_REVIEW', source: 'daily_report', invoice_date: reportDate }); } catch {}
    }

    return NextResponse.json({
      success: true, report: savedReport, reportType, reportDate,
      shortOver, expectedInSafe, safeDrops,
      deliveriesLogged: (extracted.deliveries||[]).length,
      checksFound: (extracted.checks_given||[]).length,
      needsCashCount: abs(merged.actual_cash) === 0 && expectedInSafe > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report:', err);
    return NextResponse.json({ error: `Something went wrong: ${err.message || 'Please try again'}` }, { status: 500 });
  }
}
