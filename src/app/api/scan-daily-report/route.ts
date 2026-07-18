// v75-no-gemini
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendStoreNotification } from '@/lib/send-notification';

// ── 100% safe number - handles every format ──────────────────────────────────
function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  // Treat as positive always (caller decides sign)
  return Math.abs(Math.round(num * 100) / 100);
}

// ── BULLETPROOF date - always returns valid YYYY-MM-DD ────────────────────────
function safeDate(raw: any, fallback: string): string {
  if (!raw || raw === 'null' || raw === 'undefined') return fallback;
  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  try {
    // MM/DD/YYYY or M/D/YY
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }
    // "Jul 01 2026" or "Jul1 2026" or "JUL012026"
    const MONTHS: Record<string,string> = {
      jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
      jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'
    };
    m = s.match(/([a-z]{3})\w*\s*(\d{1,2})[,\s]+(\d{4})/i);
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon) return `${m[3]}-${mon}-${m[2].padStart(2,'0')}`;
    }
    // Compact "JUL012026"
    m = s.match(/([a-z]{3})(\d{2})(\d{4})/i);
    if (m) {
      const mon = MONTHS[m[1].toLowerCase()];
      if (mon) return `${m[3]}-${mon}-${m[2]}`;
    }
    // Let JS try
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}

  return fallback;
}

// ── Parse JSON from AI response - 4 fallback strategies ──────────────────────
function parseJSON(raw: string): Record<string,any> | null {
  if (!raw) return null;
  let s = raw.trim()
    .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  const start = s.indexOf('{');
  if (start < 0) return null;
  s = s.slice(start);

  // Strategy 1: straight parse
  try { return JSON.parse(s); } catch {}

  // Strategy 2: close unclosed structures
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

  // Strategy 3: remove trailing incomplete key
  try { return JSON.parse(s.replace(/,\s*"[^"]*"?\s*:\s*[^,}\]]*$/, '').replace(/,\s*$/, '') + '}'); } catch {}

  // Strategy 4: extract just first level keys
  try {
    const pairs: Record<string,any> = {};
    const re = /"([^"]+)"\s*:\s*("([^"\\]|\\.)*"|null|true|false|-?\d+\.?\d*)/g;
    let match;
    while ((match = re.exec(s)) !== null) pairs[match[1]] = JSON.parse(match[2]);
    if (Object.keys(pairs).length > 0) return pairs;
  } catch {}

  return null;
}

// ── Call AI with 3-model fallback ─────────────────────────────────────────────
async function aiExtract(imgs: {b64:string;mime:string}[], prompt: string, tokens: number, key: string): Promise<Record<string,any> | null> {
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const img of imgs) {
    if (img.mime === 'application/pdf') {
      content.push({ type: 'file', file: { filename: 'report.pdf', file_data: `data:application/pdf;base64,${img.b64}` } });
    } else {
      content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } });
    }
  }

  for (const model of ['anthropic/claude-haiku-4-5', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-haiku']) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: tokens, messages: [{ role: 'user', content }] }),
      });
      if (!r.ok) continue;
      const d = await r.json();
      const raw = d?.choices?.[0]?.message?.content ?? '';
      const parsed = parseJSON(raw);
      if (parsed && Object.keys(parsed).length > 2) return parsed;
    } catch {}
  }
  return null;
}

// ── Merge new data into existing report ───────────────────────────────────────
function mergeReport(existing: any, u: any, type: string): any {
  const take = (f: string) => toNum(u[f]) || toNum(existing?.[f]);
  const add  = (f: string) => toNum(u[f]) + toNum(existing?.[f]);

  if (type === 'store_close') {
    return {
      ...existing,
      gross_sales:           toNum(u.gross_sales) || toNum(existing?.gross_sales),
      fuel_sales:            toNum(u.fuel_sales)  || toNum(existing?.fuel_sales),
      inside_sales:          toNum(u.non_fuel_sales) || toNum(u.inside_sales) || toNum(existing?.inside_sales),
      taxes:                 take('taxes'),
      discounts:             take('discounts'),
      // IMPORTANT: At 24 Seven Mart / Texaco, credit comes from multiple rows:
      // 1. CRIND CR Local Acct (biggest - pay-at-pump credit)
      // 2. AUX NW CRIND Credit (another pump credit line)
      // 3. Crind CREDIT (additional credit)
      // 4. Credit / Credit Local Acct (inside credit)
      credit_sales:          toNum(u.crind_cr_local) + toNum(u.aux_nw_crind) + toNum(u.crind_credit_extra) + toNum(u.credit_sales) || toNum(existing?.credit_sales),
      debit_sales:           toNum(u.crind_debit) + toNum(u.debit_sales) || toNum(existing?.debit_sales),
      cash_sales:            take('cash_sales'),
      check_sales:           take('check_sales'),
      ebt_sales:             take('ebt_sales'),
      atm_sales:             take('crind_cash'),
      transactions:          take('transactions'),
      customers:             take('customers'),
      fuel_unleaded_sales:   take('fuel_unleaded_sales'),
      fuel_midgrade_sales:   take('fuel_midgrade_sales'),
      fuel_premium_sales:    take('fuel_premium_sales'),
      fuel_diesel_sales:     take('fuel_diesel_sales'),
      fuel_unleaded_gallons: take('fuel_unleaded_gallons'),
      fuel_midgrade_gallons: take('fuel_midgrade_gallons'),
      fuel_premium_gallons:  take('fuel_premium_gallons'),
      fuel_diesel_gallons:   take('fuel_diesel_gallons'),
      department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) },
    };
  }

  if (type === 'till') {
    // CRITICAL: Cashier Safe Drops (cash only) ≠ System Safe Drops (all payments)
    // Use cashier_safe_drops for short/over - that's actual cash in safe
    return {
      ...existing,
      beginning_till:        take('beginning_till'),
      // Cashier safe drops = actual cash physically dropped
      safe_drops:            toNum(u.cashier_safe_drops) + toNum(existing?.safe_drops),
      safe_loans:            toNum(u.safe_loans) + toNum(existing?.safe_loans),
      paid_ins:              add('paid_ins'),
      paid_outs:             toNum(u.paid_outs) + toNum(existing?.paid_outs),
      cashier_short:         add('cashier_short'),
      cashier_over:          add('cashier_over'),
      // Credit from system safe drops = card totals
      credit_sales:          toNum(u.system_credit) + toNum(existing?.credit_sales),
      debit_sales:           toNum(u.system_debit)  + toNum(existing?.debit_sales),
    };
  }

  if (type === 'lottery') return {
    ...existing,
    lottery_sales:      take('lottery_net_sales') || take('lottery_gross_sales'),
    scratch_sales:      take('scratch_sales'),
    lottery_payouts:    add('lottery_payouts'),
    scratch_payouts:    take('scratch_cashes'),
    lottery_settlement: take('settlements'),
    lottery_commission: take('commissions'),
  };

  if (type === 'handwritten') return {
    ...existing,
    safe_drops:   toNum(u.safe_drops_total) || toNum(existing?.safe_drops),
    paid_outs:    add('paid_outs'),
    paid_ins:     add('paid_ins'),
    check_sales:  toNum(u.checks_total) + toNum(existing?.check_sales),
    checks_given:   [...(existing?.checks_given||[]),   ...(u.checks_given||[])],
    deliveries:     [...(existing?.deliveries||[]),     ...(u.deliveries||[])],
  };

  if (type === 'department') return {
    ...existing,
    department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) },
    inside_sales: take('total_inside_sales') || toNum(existing?.inside_sales),
  };

  // Generic - pick up any non-zero field
  const m: any = { ...existing };
  for (const [k,v] of Object.entries(u)) {
    if (v !== null && v !== 0 && v !== '' && typeof v !== 'object' && !m[k]) m[k] = v;
  }
  if (u.department_sales) m.department_sales = { ...(existing?.department_sales||{}), ...(u.department_sales||{}) };
  return m;
}

// ── Short/Over: Safe Drops vs what you physically count ─────────────────────
// RULE:
// - Store Close "Cash" row = $0 at fuel stations (all payment is CRIND/card)
// - Safe Drops (from till report, cashier cash only) = what was physically dropped
// - When owner counts the safe: Short/Over = counted amount - safe drops
// - If till has CASHIER SHORT/OVER: POS already calculated it, use directly
function calcShortOver(r: any): { shortOver: number; expectedInSafe: number } {
  const cashierShort = toNum(r.cashier_short);  // POS-calculated short (positive)
  const cashierOver  = toNum(r.cashier_over);   // POS-calculated over (positive)
  const safeDrops    = toNum(r.safe_drops);     // Cashier cash drops from till

  // POS already calculated short/over across all registers
  let shortOver = 0;
  if (cashierShort > 0 || cashierOver > 0) {
    shortOver = cashierOver - cashierShort; // negative = short, positive = over
  }

  // Expected in safe = total cashier cash safe drops
  // This is the ONLY source of truth — Store Close cash row is $0 at fuel stations
  const expectedInSafe = safeDrops;

  return {
    shortOver: Math.round(shortOver * 100) / 100,
    expectedInSafe: Math.round(expectedInSafe * 100) / 100,
  };
}

// ── Main endpoint ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const today = new Date().toISOString().split('T')[0];

  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key missing — contact support' }, { status: 500 });

    const formData = await request.formData();
    const formStoreId = formData.get('store_id') as string | null;

    let store: { id: string; name: string } | null = null;
    if (formStoreId) {
      const { data } = await sb.from('stores').select('id, name').eq('id', formStoreId).eq('owner_id', user.id).maybeSingle();
      store = data;
    }
    if (!store) {
      const { data } = await sb.from('stores').select('id, name').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
      store = data;
    }
    if (!store) return NextResponse.json({ error: 'No store found — complete setup in Settings' }, { status: 400 });

    const dateOverride = (formData.get('report_date') as string) || '';

    const files: File[] = [];
    for (const [,v] of formData.entries()) {
      if (v instanceof File && v.size > 0) files.push(v);
    }
    if (!files.length) return NextResponse.json({ error: 'No image received — please try again' }, { status: 400 });

    const imgs = await Promise.all(files.map(async f => ({
      b64: Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: ['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(f.type) ? f.type : 'image/jpeg',
    })));

    // ── PROMPT 1: All numeric fields ─────────────────────────────────────────
    const NUM_PROMPT = `You are reading gas station reports from 24 Seven Mart, Texaco, and similar US stores.
These reports can be: Store Close (3 pages), Till Reports (register tape), Texas Lottery summary, Handwritten Daily Report, or Department Sales.
Read ALL images carefully. Return ONLY valid JSON — no markdown, no explanation.

{
  "report_type": null,
  "report_date": null,
  "gross_sales": null,
  "fuel_sales": null,
  "non_fuel_sales": null,
  "taxes": null,
  "discounts": null,
  "fuel_unleaded_sales": null,
  "fuel_midgrade_sales": null,
  "fuel_premium_sales": null,
  "fuel_diesel_sales": null,
  "fuel_unleaded_gallons": null,
  "fuel_midgrade_gallons": null,
  "fuel_premium_gallons": null,
  "fuel_diesel_gallons": null,
  "cash_sales": null,
  "crind_cr_local": null,
  "aux_nw_crind": null,
  "crind_credit_extra": null,
  "credit_sales": null,
  "crind_debit": null,
  "debit_sales": null,
  "ebt_sales": null,
  "check_sales": null,
  "crind_cash": null,
  "cashier_safe_drops": null,
  "safe_loans": null,
  "paid_ins": null,
  "paid_outs": null,
  "beginning_till": null,
  "system_credit": null,
  "system_debit": null,
  "cashier_short": null,
  "cashier_over": null,
  "lottery_gross_sales": null,
  "lottery_net_sales": null,
  "scratch_cashes": null,
  "settlements": null,
  "commissions": null,
  "safe_drops_total": null,
  "checks_total": null,
  "transactions": null,
  "customers": null
}

HOW TO IDENTIFY REPORT TYPE:
- "Store Close" or "Store Sales Summary Report" at top → report_type = "store_close"
- "Till Report" or "TILL REPORT COMPLETE" → report_type = "till"
- "TEXAS LOTTERY" or "LOTTERY SUMMARY" → report_type = "lottery"
- "DAILY REPORT" handwritten form with safe drops section → report_type = "handwritten"
- "Department Sales Report" page 2 → report_type = "department"
- Scratch-off count sheet → report_type = "scratch"

REPORT DATE: Return ALWAYS as YYYY-MM-DD
Examples: "Jul 02 2026"→"2026-07-02", "07/02/2026"→"2026-07-02", "07,02,2026"→"2026-07-02"
For Till Reports use the Till End date. For Store Close use the PERIOD TO date.

STORE CLOSE (Texaco / 24 Seven Mart format):
- gross_sales = "Grand Total Store Sales Reading" (top line total)
- fuel_sales = "Total Fuel Sales"  
- non_fuel_sales = "Non Fuel Sales" (inside store sales)
- taxes = "Total Taxes Collected"
- Grade 01 UNLEAD REG = fuel_unleaded_sales + fuel_unleaded_gallons
- Grade 02 UNL SUP US = fuel_midgrade_sales + fuel_midgrade_gallons
- Grade 03 REG PLS = fuel_premium_sales + fuel_premium_gallons
- Grade 04 DIESEL = fuel_diesel_sales + fuel_diesel_gallons
- METHOD OF PAYMENT section: read each row separately:
  - "Cash" row = cash_sales (usually $0 at fuel stations)
  - "CRIND CR Local Acct" = crind_cr_local (MAIN credit, usually biggest number ~$4000-6000)
  - "AUX NW CRIND Credit" = aux_nw_crind (another credit line)
  - "Crind CREDIT" = crind_credit_extra
  - "Credit" or "Credit Local Acct" = credit_sales
  - "Crind DEBIT" = crind_debit
  - "Debit" = debit_sales
  - "Check" = check_sales (in Gilbarco Passport this is the BANK CREDIT CARD BATCH SETTLEMENT — the bank pays via ACH/check for all card transactions. 239 count = 239 card swipes settled. This IS income received. Do NOT confuse with vendor checks)
  - "Cash Acceptor Cash" = crind_cash
  - CRITICAL: Vendor checks written to suppliers (Tyler Beverages, Pepsi, GG Distributing etc.) ONLY appear on the handwritten daily report in CHEQUES GIVEN section — they are EXPENSES paid OUT, never appear on Store Close Method of Payment

TILL REPORT (register receipt):
- beginning_till = "TILL BEGINNING BALANCE" (usually $250)
- cashier_short = "CASHIER SHORT AMOUNT" (OVER means drawer had more, SHORT means less) - store as positive
- cashier_over = "CASHIER OVER AMOUNT" - store as positive
- CASHIER SAFE DROPS section: cashier_safe_drops = Cash amount (NOT the credit/debit from System Safe Drops)
- safe_loans = "SAFE LOANS" Cash amount
- paid_outs = "PAID OUTS" total (positive)
- paid_ins = "PAID INS" total
- SYSTEM SAFE DROPS section: system_credit = Credit amount, system_debit = Debit amount

TEXAS LOTTERY:
- lottery_net_sales = "DRW GM NET SALES"
- lottery_gross_sales = "DRAW GM GROSS SALES"  
- scratch_cashes = "SCRATCH CASHES" (positive number, ignore minus sign)
- settlements = "SETTLEMENTS" amount
- commissions = "COMMISSIONS" (positive, ignore minus)

HANDWRITTEN DAILY REPORT (24/7 Mart form):
- safe_drops_total = sum ALL drop amounts listed (Drop Amount 1 + 2 + 3 etc.)
- paid_outs = any Payout amounts (positive)
- checks_total = sum of all check amounts in CHEQUES GIVEN section

All amounts: return as positive numbers only. null if not visible. Never calculate.`;

    // ── PROMPT 2: Lists and department sales (separate smaller call) ──────────
    const LIST_PROMPT = `Gas station report reader. Extract lists from the image. Return ONLY valid JSON:
{"department_sales":{},"checks_given":[],"deliveries":[],"safe_drop_list":[]}

department_sales: From Department Sales page, use GROSS SALES column only:
{"BEER":1085.30,"SNACK":884.78,"SCRATCH OFF":1752.00,"SODA":803.47}
Include negative values like {"LOTTO P/O":-1265.00}

checks_given: From handwritten daily report CHEQUES GIVEN section:
[{"payee":"Tyler Beverages","amount":906.05},{"payee":"GG Distribut","amount":4977.52}]

deliveries: From DELIVERIES ARRIVED section:
[{"vendor":"Tyler Beverages","amount":906.05}]

safe_drop_list: From SAFE DROPS section of handwritten report:
[{"amount":2100,"time":"10:43","by":"Shayan"},{"amount":377,"time":"11:02","by":"Shayan"}]

Return empty arrays/objects if section not visible.`;

    // Run both in parallel
    const [numData, listData] = await Promise.all([
      aiExtract(imgs, NUM_PROMPT, 900, apiKey),
      aiExtract(imgs, LIST_PROMPT, 1200, apiKey),
    ]);

    if (!numData) {
      return NextResponse.json({
        error: 'Could not read the report. Tips:\n• Better lighting\n• Hold phone steady\n• Make sure text is clear\n• Try uploading a photo file instead of scanning'
      }, { status: 502 });
    }

    const reportType = (numData.report_type || 'unknown').toString().toLowerCase().trim();
    const reportDate = safeDate(numData.report_date, dateOverride || today);

    // Save upload
    let uploadId: string | null = null;
    try {
      const { data: up } = await sb.from('report_uploads').insert({
        store_id: store.id, report_date: reportDate, report_type: reportType,
        file_name: files.map(f => f.name || 'photo').join(', '),
        status: 'completed', raw_extraction: numData,
        processed_at: new Date().toISOString(),
      }).select('id').single();
      uploadId = up?.id ?? null;
    } catch {}

    // Get existing and merge
    const { data: existing } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();

    const merged = mergeReport(existing || {}, {
      ...numData,
      ...(listData || {}),
    }, reportType);

    const { shortOver, expectedInSafe } = calcShortOver(merged);

    // Build payload - EVERY field sanitized to prevent DB errors
    const P = (v: any) => { const n = toNum(v); return isNaN(n) ? 0 : n; };
    const PI = (v: any) => Math.round(P(v));

    const payload: Record<string,any> = {
      store_id:              store.id,
      report_date:           reportDate,  // always YYYY-MM-DD
      status:                'in_progress',
      gross_sales:           P(merged.gross_sales),
      fuel_sales:            P(merged.fuel_sales),
      inside_sales:          P(merged.inside_sales),
      merchandise_sales:     P(merged.merchandise_sales),
      lottery_sales:         P(merged.lottery_sales),
      scratch_sales:         P(merged.scratch_sales),
      lottery_payouts:       P(merged.lottery_payouts),
      scratch_payouts:       P(merged.scratch_payouts),
      lottery_settlement:    P(merged.lottery_settlement),
      lottery_commission:    P(merged.lottery_commission),
      taxes:                 P(merged.taxes),
      discounts:             P(merged.discounts),
      refunds:               P(merged.refunds),
      transactions:          PI(merged.transactions),
      customers:             PI(merged.customers),
      cash_sales:            P(merged.cash_sales),
      credit_sales:          P(merged.credit_sales),
      debit_sales:           P(merged.debit_sales),
      ebt_sales:             P(merged.ebt_sales),
      check_sales:           P(merged.check_sales),
      money_order_sales:     P(merged.money_order_sales),
      atm_sales:             P(merged.atm_sales),
      safe_drops:            P(merged.safe_drops),
      safe_loans:            P(merged.safe_loans),
      paid_ins:              P(merged.paid_ins),
      paid_outs:             P(merged.paid_outs),
      beginning_till:        P(merged.beginning_till),
      ending_till:           P(merged.ending_till),
      expected_cash:         expectedInSafe,
      actual_cash:           P(merged.actual_cash),
      cash_deposit:          P(merged.cash_deposit),
      drawer_difference:     shortOver,
      fuel_unleaded_sales:   P(merged.fuel_unleaded_sales),
      fuel_midgrade_sales:   P(merged.fuel_midgrade_sales),
      fuel_premium_sales:    P(merged.fuel_premium_sales),
      fuel_diesel_sales:     P(merged.fuel_diesel_sales),
      fuel_unleaded_gallons: P(merged.fuel_unleaded_gallons),
      fuel_midgrade_gallons: P(merged.fuel_midgrade_gallons),
      fuel_premium_gallons:  P(merged.fuel_premium_gallons),
      fuel_diesel_gallons:   P(merged.fuel_diesel_gallons),
      department_sales:      (merged.department_sales && typeof merged.department_sales === 'object') ? merged.department_sales : {},
      validation_warnings:   [],
      ai_validated:          true,
      ai_notes:              [
        (merged.deliveries||[]).length > 0 ? `${merged.deliveries.length} deliveries sent to Invoices` : null,
        (merged.checks_given||[]).length > 0 ? `${merged.checks_given.length} vendor checks recorded` : null,
      ].filter(Boolean).join(' · ') || null,
      updated_at:            new Date().toISOString(),
    };

    let savedReport: any = null;
    if (existing) {
      const { data, error } = await sb.from('daily_reports').update(payload).eq('id', existing.id).select('*').single();
      if (error) return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
      savedReport = data;
    } else {
      const { data, error } = await sb.from('daily_reports').insert(payload).select('*').single();
      if (error) return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
      savedReport = data;
    }

    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    // Auto-log deliveries to invoices queue
    for (const d of (merged.deliveries || [])) {
      if (!d.vendor && !d.name) continue;
      try {
        await sb.from('invoices').insert({
          store_id: store.id,
          vendor_name: (d.vendor || d.name || 'Unknown').trim(),
          total_amount: P(d.amount) || null,
          status: 'NEEDS_REVIEW',
          source: 'daily_report',
          invoice_date: reportDate,
        });
      } catch {}
    }

    // Auto-log vendor checks (from handwritten daily report CHEQUES GIVEN section)
    // These are expenses/payments made OUT to vendors — saved as completed invoices
    for (const c of (merged.checks_given || [])) {
      if (!c.payee && !c.vendor) continue;
      try {
        await sb.from('invoices').insert({
          store_id: store.id,
          vendor_name: (c.payee || c.vendor || 'Unknown vendor').trim(),
          invoice_number: c.number ? String(c.number) : null,
          total_amount: P(c.amount) || null,
          status: 'COMPLETED',  // Already paid — check was written
          source: 'vendor_check',
          invoice_date: reportDate,
        });
      } catch {}
    }

    // Notify the owner's devices about today's numbers — short/over and
    // stock issues are exactly what an owner wants to know the moment a
    // report comes in, not just when they happen to open the app.
    if (savedReport && reportDate === new Date().toISOString().split('T')[0]) {
      try {
        const { data: lowProducts } = await sb.from('products').select('quantity,min_quantity').eq('store_id', store.id).eq('is_active', true);
        const outOfStockCount = (lowProducts || []).filter((p: any) => p.quantity === 0).length;
        const lowStockCount = (lowProducts || []).filter((p: any) => p.quantity > 0 && p.quantity <= p.min_quantity).length;
        const isShortNotif = shortOver < -0.50;
        const isOverNotif = shortOver > 0.50;

        let notifBody = `Sales: $${Number(savedReport.gross_sales || 0).toFixed(2)}`;
        if (isShortNotif) notifBody += ` · ⚠ $${Math.abs(shortOver).toFixed(2)} SHORT`;
        else if (isOverNotif) notifBody += ` · +$${shortOver.toFixed(2)} over`;
        else notifBody += ' · ✓ Balanced';
        if (outOfStockCount > 0) notifBody += ` · ${outOfStockCount} out of stock`;
        if (lowStockCount > 0) notifBody += ` · ${lowStockCount} low`;

        sendStoreNotification(sb, store.id, `${store.name || 'Your store'} — Report Ready`, notifBody).catch(() => {});
      } catch (notifErr) {
        console.error('daily report notification trigger failed (non-fatal):', notifErr);
      }
    }

    return NextResponse.json({
      success: true, report: savedReport, reportType, reportDate,
      shortOver, expectedInSafe,
      safeDrops: P(merged.safe_drops),
      deliveriesLogged: (merged.deliveries||[]).length,
      checksFound: (merged.checks_given||[]).length,
      needsCashCount: P(merged.actual_cash) === 0 && expectedInSafe > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report error:', err);
    return NextResponse.json({ error: `Error: ${err.message || 'Please try again'}` }, { status: 500 });
  }
}
