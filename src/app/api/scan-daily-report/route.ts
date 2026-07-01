import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

// ── Safe converters ──────────────────────────────────────────────────────────
function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  // Handle negative formats: -$123, ($123), 123-, 123−
  let s = String(v).replace(/[$,\s]/g, '').trim();
  const neg = s.startsWith('-') || s.startsWith('(') || s.endsWith('-') || s.endsWith('−');
  s = s.replace(/[-−()\+]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round((neg ? -n : n) * 100) / 100;
}

function absNum(v: any): number { return Math.abs(toNum(v)); }

function toDate(raw: any, fallback: string): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    // MM/DD/YYYY, MM/DD/YY, MM-DD-YYYY
    const a = s.match(/(\d{1,2})[\/\-,](\d{1,2})[\/\-,](\d{2,4})/);
    if (a) {
      const y = a[3].length===2 ? '20'+a[3] : a[3];
      return `${y}-${a[1].padStart(2,'0')}-${a[2].padStart(2,'0')}`;
    }
    // "Jun 30 2026", "JUNE30 2026", "JUL01 2026"
    const M: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const b = s.match(/([a-z]{3})\w*[\s,]*(\d{1,2})[\s,]+(\d{4})/i);
    if (b) { const mn=M[b[1].toLowerCase()]; if(mn) return `${b[3]}-${mn}-${b[2].padStart(2,'0')}`; }
    // "JUL012026" compact format
    const c = s.match(/([a-z]{3})(\d{2})(\d{4})/i);
    if (c) { const mn=M[c[1].toLowerCase()]; if(mn) return `${c[3]}-${mn}-${c[2]}`; }
    const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return fallback;
}

// ── AI extraction - one call reads ALL images ────────────────────────────────
async function callAI(images: {b64:string;mime:string}[], apiKey: string): Promise<any> {
  const content: any[] = [{
    type: 'text',
    text: `You are reading gas station daily closing documents for 24 Seven Mart / Texaco stores.
Read ALL images carefully. There may be multiple report types in the same upload.
Return ONLY valid JSON - no markdown, no text before or after.

{
  "report_type": "store_close",
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
  "credit_sales": null,
  "debit_sales": null,
  "ebt_sales": null,
  "check_sales": null,
  "crind_credit": null,
  "crind_debit": null,
  "crind_cash": null,
  "safe_drops": null,
  "safe_loans": null,
  "paid_ins": null,
  "paid_outs": null,
  "beginning_till": null,
  "cashier_short": null,
  "cashier_over": null,
  "lottery_sales": null,
  "scratch_sales": null,
  "scratch_payouts": null,
  "lottery_settlements": null,
  "lottery_commissions": null,
  "lottery_balance": null,
  "refunds": null,
  "transactions": null,
  "customers": null,
  "department_sales": {},
  "checks_given": [],
  "deliveries": [],
  "tickets_activated": [],
  "safe_drop_list": [],
  "notes": ""
}

=== CRITICAL RULES - READ CAREFULLY ===

REPORT DATE: Return as YYYY-MM-DD always.
  "Jun 30 2026" → "2026-06-30"
  "06/30/2026" → "2026-06-30"  
  "06,30,2026" → "2026-06-30"
  "WED JUL01 2026" → "2026-07-01"
  "TUE JUN30 2026" → "2026-06-30"

REPORT TYPE: Choose ONE: store_close | till | lottery | scratch | department | handwritten | fuel_atg | unknown

=== STORE CLOSE REPORT (24 Seven Mart / Texaco format) ===
- gross_sales = "Grand Total Store Sales Reading" - the SINGLE largest total at top
- fuel_sales = "Total Fuel Sales" line
- non_fuel_sales = "Non Fuel Sales" line (NOT fuel discounts)
- taxes = "Total Taxes Collected"
- discounts = "Other Discounts" or "Fuel Discounts" (store as negative or positive)
- fuel_unleaded_sales = Grade 01 UNLEAD REG Sales column
- fuel_midgrade_sales = Grade 02 UNL SUP US Sales column
- fuel_premium_sales = Grade 03 REG PLS Sales column
- fuel_diesel_sales = Grade 04 DIESEL #1 Sales column
- fuel_unleaded_gallons = Grade 01 Volume column
- fuel_midgrade_gallons = Grade 02 Volume column
- fuel_premium_gallons = Grade 03 Volume column
- fuel_diesel_gallons = Grade 04 Volume column

METHOD OF PAYMENT section - READ EACH ROW SEPARATELY:
- cash_sales = row labeled "Cash" ONLY (usually $0 at fuel stations)
- crind_cash = "Cash Acceptor Cash" row
- check_sales = "Check" row (253 count in your store)
- crind_credit = "CRIND CR Local Acct" row - THIS IS THE MAIN CREDIT (usually $6000+)
- credit_sales = "Credit" row or "Credit Local Acct" row (usually $0 separate)
- crind_debit = "Crind DEBIT" row
- debit_sales = "Debit" row

DEPARTMENT SALES from store close page 2:
- Read GROSS SALES $ column only (not Net Sales)
- department_sales = {"BEER": 820.51, "SNACK": 895.47, "NONTAX": 1274.00, ...}
- Include ALL departments including negative ones like LOTTO P/O

=== TILL REPORT (register tape) ===
- beginning_till = "TILL BEGINNING BALANCE" (usually $250 or $250.15)
- cashier_short = "CASHIER SHORT AMOUNT" - store as POSITIVE number
- cashier_over = "CASHIER OVER AMOUNT" - store as POSITIVE number
- safe_drops = Total of Cashier Safe Drops (Cash total only, NOT System Safe Drops)
- safe_loans = "SAFE LOANS" Cash amount
- paid_ins = "PAID INS" total
- paid_outs = "PAID OUTS" total - store as POSITIVE
- credit_sales = Credit amount from SYSTEM SAFE DROPS section (or CASHIER COUNTED)
- debit_sales = Debit amount from SYSTEM SAFE DROPS section

=== TEXAS LOTTERY ===
- lottery_sales = "DRW GM NET SALES" amount
- scratch_payouts = "SCRATCH CASHES" amount - store as POSITIVE (ignore minus sign)
- lottery_settlements = "SETTLEMENTS" amount
- lottery_commissions = "COMMISSIONS" amount - store as POSITIVE (ignore minus sign)
- lottery_balance = "BALANCE" amount

=== HANDWRITTEN DAILY REPORT (24/7 Mart Daily Report form) ===
- safe_drop_list = [{"amount": 293, "time": "6:18AM", "by": "Shayan"}, ...]
- safe_drops = sum all safe drop amounts
- paid_ins = total Paid In amount
- paid_outs = total Paid Out amount (sum all, store positive)
- checks_given = [{"number": "4573", "payee": "Tylers Ice", "amount": 829.00}, ...]
- deliveries = [{"vendor": "Pepsi", "amount": 681.61}, ...]
- tickets_activated = [{"book": "2739", "slot": 2, "price": 5}, ...]

Use null for any field not visible. Store all amounts as positive numbers unless otherwise noted. Never calculate - read exactly as printed.`
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
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0,300)}`);
  const data = await res.json();
  let raw = (data?.choices?.[0]?.message?.content ?? '').trim()
    .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  const match = raw.match(/\{[\s\S]*/);
  if (!match) throw new Error(`No JSON found. AI returned: ${raw.slice(0,300)}`);
  let js = match[0];

  try { return JSON.parse(js); } catch {}

  // Recovery parser for truncated JSON
  let depth=0, inStr=false, esc=false;
  for (const ch of js) {
    if (esc) { esc=false; continue; }
    if (ch==='\\') { esc=true; continue; }
    if (ch==='"') { inStr=!inStr; continue; }
    if (!inStr) { if(ch==='{'||ch==='[') depth++; else if(ch==='}'||ch===']') depth--; }
  }
  if (inStr) js+='"';
  while (depth > 0) { js+='}'; depth--; }
  try { return JSON.parse(js); } catch { throw new Error(`JSON parse failed after recovery`); }
}

// ── Merge: combine this upload with any existing data ────────────────────────
function merge(existing: any, u: any): any {
  const n = toNum;
  const keep = (f: string) => absNum(existing?.[f]) > 0 ? n(existing[f]) : n(u[f]);
  const sum  = (f: string) => absNum(existing?.[f]) + absNum(u[f]);
  const t = (u.report_type||'unknown').toLowerCase();

  if (t === 'store_close') {
    // Store close is the master — always use its numbers as primary
    // CRIND CR Local Acct is the main credit line at Texaco stores
    const totalCredit = absNum(u.crind_credit) + absNum(u.credit_sales);
    const totalDebit  = absNum(u.crind_debit)  + absNum(u.debit_sales);
    return {
      ...existing,
      gross_sales:          absNum(u.gross_sales) || absNum(existing?.gross_sales),
      fuel_sales:           absNum(u.fuel_sales)  || absNum(existing?.fuel_sales),
      inside_sales:         absNum(u.non_fuel_sales) || absNum(existing?.inside_sales),
      taxes:                absNum(u.taxes)  || absNum(existing?.taxes),
      discounts:            absNum(u.discounts) || absNum(existing?.discounts),
      refunds:              keep('refunds'),
      transactions:         keep('transactions'),
      customers:            keep('customers'),
      cash_sales:           absNum(u.cash_sales) || absNum(existing?.cash_sales),
      credit_sales:         totalCredit || absNum(existing?.credit_sales),
      debit_sales:          totalDebit  || absNum(existing?.debit_sales),
      ebt_sales:            keep('ebt_sales'),
      check_sales:          absNum(u.check_sales) || absNum(existing?.check_sales),
      atm_sales:            absNum(u.crind_cash)  || absNum(existing?.atm_sales),
      fuel_unleaded_sales:  absNum(u.fuel_unleaded_sales)  || absNum(existing?.fuel_unleaded_sales),
      fuel_midgrade_sales:  absNum(u.fuel_midgrade_sales)  || absNum(existing?.fuel_midgrade_sales),
      fuel_premium_sales:   absNum(u.fuel_premium_sales)   || absNum(existing?.fuel_premium_sales),
      fuel_diesel_sales:    absNum(u.fuel_diesel_sales)    || absNum(existing?.fuel_diesel_sales),
      fuel_unleaded_gallons:absNum(u.fuel_unleaded_gallons)|| absNum(existing?.fuel_unleaded_gallons),
      fuel_midgrade_gallons:absNum(u.fuel_midgrade_gallons)|| absNum(existing?.fuel_midgrade_gallons),
      fuel_premium_gallons: absNum(u.fuel_premium_gallons) || absNum(existing?.fuel_premium_gallons),
      fuel_diesel_gallons:  absNum(u.fuel_diesel_gallons)  || absNum(existing?.fuel_diesel_gallons),
      department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) },
    };
  }

  if (t === 'till') {
    // Multiple till reports (multiple registers) — accumulate across registers
    return {
      ...existing,
      beginning_till: absNum(u.beginning_till) || absNum(existing?.beginning_till),
      safe_drops:     absNum(u.safe_drops)  + absNum(existing?.safe_drops),
      safe_loans:     absNum(u.safe_loans)  + absNum(existing?.safe_loans),
      paid_ins:       absNum(u.paid_ins)    + absNum(existing?.paid_ins),
      paid_outs:      absNum(u.paid_outs)   + absNum(existing?.paid_outs),
      // Accumulate short/over across all registers
      cashier_short:  absNum(u.cashier_short) + absNum(existing?.cashier_short),
      cashier_over:   absNum(u.cashier_over)  + absNum(existing?.cashier_over),
      // Credit/debit from till (system safe drops section)
      credit_sales:   absNum(u.credit_sales) + absNum(existing?.credit_sales),
      debit_sales:    absNum(u.debit_sales)  + absNum(existing?.debit_sales),
    };
  }

  if (t === 'lottery') {
    return {
      ...existing,
      lottery_sales:      absNum(u.lottery_sales) || absNum(existing?.lottery_sales),
      scratch_sales:      absNum(u.scratch_sales) || absNum(existing?.scratch_sales),
      scratch_payouts:    absNum(u.scratch_payouts) || absNum(existing?.scratch_payouts),
      lottery_settlement: absNum(u.lottery_settlements) || absNum(existing?.lottery_settlement),
      lottery_commission: absNum(u.lottery_commissions) || absNum(existing?.lottery_commission),
    };
  }

  if (t === 'handwritten') {
    const checksTotal = (u.checks_given||[]).reduce((s:number,c:any)=>s+absNum(c.amount),0);
    return {
      ...existing,
      safe_drops:      absNum(u.safe_drops) || absNum(existing?.safe_drops),
      paid_ins:        absNum(u.paid_ins) + absNum(existing?.paid_ins),
      paid_outs:       absNum(u.paid_outs) + absNum(existing?.paid_outs),
      check_sales:     checksTotal + absNum(existing?.check_sales),
      checks_given:    [...(existing?.checks_given||[]), ...(u.checks_given||[])],
      deliveries:      [...(existing?.deliveries||[]), ...(u.deliveries||[])],
      tickets_activated:[...(existing?.tickets_activated||[]), ...(u.tickets_activated||[])],
    };
  }

  if (t === 'department') {
    return { ...existing, department_sales: { ...(existing?.department_sales||{}), ...(u.department_sales||{}) } };
  }

  // Generic fallback
  const m = { ...existing };
  for (const [k,v] of Object.entries(u)) {
    if (v !== null && v !== 0 && v !== '' && typeof v !== 'object' && !['report_type','report_date','notes'].includes(k) && !(m as any)[k]) {
      (m as any)[k] = v;
    }
  }
  if (u.department_sales && Object.keys(u.department_sales).length>0)
    m.department_sales = { ...(existing?.department_sales||{}), ...(u.department_sales||{}) };
  return m;
}

// ── Short/Over: net across all registers from till reports ───────────────────
function calcShortOver(merged: any) {
  // Net short/over = total over - total short (from all till reports)
  const totalShort = absNum(merged.cashier_short); // sum of all register shorts
  const totalOver  = absNum(merged.cashier_over);  // sum of all register overs
  const netShortOver = totalOver > 0 || totalShort > 0
    ? Math.round((totalOver - totalShort) * 100) / 100
    : 0;

  // Expected cash from POS store close numbers
  const cashSales     = absNum(merged.cash_sales);
  const safeDrops     = absNum(merged.safe_drops);
  const paidOuts      = absNum(merged.paid_outs);
  const paidIns       = absNum(merged.paid_ins);
  const safeLoans     = absNum(merged.safe_loans);
  const beginningTill = absNum(merged.beginning_till);
  const grossSales    = absNum(merged.gross_sales);

  let expectedCash = absNum(merged.expected_cash);
  if (!expectedCash) {
    if (cashSales > 0 || beginningTill > 0) {
      expectedCash = beginningTill + cashSales - safeDrops - paidOuts + paidIns + safeLoans;
    } else if (grossSales > 0) {
      // Estimate cash from gross minus non-cash
      const nonCash = absNum(merged.credit_sales) + absNum(merged.debit_sales) +
                      absNum(merged.ebt_sales) + absNum(merged.check_sales) + absNum(merged.atm_sales);
      const estCash = Math.max(0, grossSales - nonCash);
      expectedCash = beginningTill + estCash - safeDrops - paidOuts + paidIns + safeLoans;
    }
  }

  return {
    shortOver: netShortOver,
    expectedCash: Math.round(expectedCash * 100) / 100,
  };
}

// ── Auto-send deliveries to invoices queue ───────────────────────────────────
async function processDeliveries(sb: any, storeId: string, deliveries: any[], reportDate: string) {
  if (!deliveries?.length) return;
  for (const d of deliveries) {
    const vendor = String(d.vendor || d.name || '').trim();
    const amount = absNum(d.amount);
    if (!vendor) continue;
    try {
      await sb.from('invoices').insert({
        store_id: storeId,
        vendor_name: vendor,
        total_amount: amount || null,
        status: 'NEEDS_REVIEW',
        source: 'daily_report',
        invoice_date: reportDate,
      });
    } catch {}
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured in Vercel environment' }, { status: 500 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found. Complete store setup in Settings first.' }, { status: 400 });

    const formData = await request.formData();
    const reportDateOverride = formData.get('report_date') as string;

    // Collect ALL uploaded files regardless of field name
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

    // AI extraction
    let extracted: any;
    try { extracted = await callAI(images, apiKey); }
    catch (e: any) { return NextResponse.json({ error: `AI failed: ${e.message}` }, { status: 502 }); }

    // Safe date
    const today = new Date().toISOString().split('T')[0];
    const reportDate = toDate(extracted.report_date, reportDateOverride || today);
    const reportType = (extracted.report_type || 'unknown').toLowerCase();

    // Save upload record
    let uploadId: string | null = null;
    try {
      const { data: up } = await sb.from('report_uploads').insert({
        store_id: store.id,
        report_date: reportDate,
        report_type: reportType,
        file_name: files.map(f => f.name || 'photo').join(', '),
        status: 'completed',
        raw_extraction: extracted,
        processed_at: new Date().toISOString(),
      }).select('id').single();
      uploadId = up?.id ?? null;
    } catch {}

    // Get existing report for this date and merge
    const { data: existing } = await sb.from('daily_reports').select('*')
      .eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
    const merged = merge(existing || {}, extracted);

    // Calculate short/over
    const { shortOver, expectedCash } = calcShortOver(merged);

    // Process deliveries → invoices queue
    const deliveries = extracted.deliveries || [];
    await processDeliveries(sb, store.id, deliveries, reportDate);

    // Build safe DB payload - every field explicitly sanitized
    const checksFromHandwritten = (extracted.checks_given||[]).reduce((s:number,c:any)=>s+absNum(c.amount),0);

    const payload: Record<string, any> = {
      store_id:              store.id,
      report_date:           reportDate,
      status:                'in_progress',
      gross_sales:           absNum(merged.gross_sales),
      net_sales:             absNum(merged.net_sales),
      fuel_sales:            absNum(merged.fuel_sales),
      inside_sales:          absNum(merged.inside_sales) || absNum(merged.non_fuel_sales),
      merchandise_sales:     absNum(merged.merchandise_sales),
      lottery_sales:         absNum(merged.lottery_sales),
      scratch_sales:         absNum(merged.scratch_sales),
      lottery_payouts:       absNum(merged.lottery_payouts),
      scratch_payouts:       absNum(merged.scratch_payouts),
      lottery_settlement:    absNum(merged.lottery_settlement) || absNum(merged.lottery_settlements),
      lottery_commission:    absNum(merged.lottery_commission) || absNum(merged.lottery_commissions),
      taxes:                 absNum(merged.taxes),
      discounts:             absNum(merged.discounts),
      refunds:               absNum(merged.refunds),
      transactions:          Math.round(absNum(merged.transactions)),
      customers:             Math.round(absNum(merged.customers)),
      cash_sales:            absNum(merged.cash_sales),
      credit_sales:          absNum(merged.credit_sales),
      debit_sales:           absNum(merged.debit_sales),
      ebt_sales:             absNum(merged.ebt_sales),
      check_sales:           absNum(merged.check_sales) || checksFromHandwritten,
      money_order_sales:     absNum(merged.money_order_sales),
      atm_sales:             absNum(merged.atm_sales),
      safe_drops:            absNum(merged.safe_drops),
      safe_loans:            absNum(merged.safe_loans),
      paid_ins:              absNum(merged.paid_ins),
      paid_outs:             absNum(merged.paid_outs),
      beginning_till:        absNum(merged.beginning_till),
      ending_till:           absNum(merged.ending_till),
      expected_cash:         expectedCash,
      actual_cash:           absNum(merged.actual_cash),
      cash_deposit:          absNum(merged.cash_deposit),
      drawer_difference:     shortOver,
      fuel_unleaded_sales:   absNum(merged.fuel_unleaded_sales),
      fuel_midgrade_sales:   absNum(merged.fuel_midgrade_sales),
      fuel_premium_sales:    absNum(merged.fuel_premium_sales),
      fuel_diesel_sales:     absNum(merged.fuel_diesel_sales),
      fuel_unleaded_gallons: absNum(merged.fuel_unleaded_gallons),
      fuel_midgrade_gallons: absNum(merged.fuel_midgrade_gallons),
      fuel_premium_gallons:  absNum(merged.fuel_premium_gallons),
      fuel_diesel_gallons:   absNum(merged.fuel_diesel_gallons),
      department_sales:      merged.department_sales || {},
      validation_warnings:   [],
      ai_validated:          true,
      ai_notes:              [
        deliveries.length > 0 ? `${deliveries.length} deliveries sent to Invoices for review` : null,
        (extracted.checks_given||[]).length > 0 ? `${(extracted.checks_given||[]).length} checks recorded` : null,
        (extracted.tickets_activated||[]).length > 0 ? `${(extracted.tickets_activated||[]).length} lottery tickets activated` : null,
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

    // Link upload to report
    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    // Timeline event
    try {
      if (deliveries.length > 0) {
        await sb.from('timeline_events').insert({
          store_id: store.id,
          event_date: reportDate,
          type: 'delivery',
          title: `${deliveries.length} vendor deliveries logged`,
          description: deliveries.map((d:any)=>d.vendor).filter(Boolean).join(', '),
        });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      report: savedReport,
      reportType,
      reportDate,
      shortOver,
      expectedCash,
      deliveriesLogged: deliveries.length,
      checksFound: (extracted.checks_given||[]).length,
      ticketsActivated: (extracted.tickets_activated||[]).length,
      needsCashCount: absNum(merged.actual_cash) === 0 && expectedCash > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
