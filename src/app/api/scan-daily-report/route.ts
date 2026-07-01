import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

// ── Safe converters ──────────────────────────────────────────────────────────
function toNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/[$,\s\-\(\)]/g, '').replace(/−/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function toDate(raw: any, fallback: string): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const a = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (a) { const y = a[3].length===2?'20'+a[3]:a[3]; return `${y}-${a[1].padStart(2,'0')}-${a[2].padStart(2,'0')}`; }
    const M: Record<string,string> = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
    const b = s.match(/([a-z]{3})\w*[\s,]+(\d{1,2})[\s,]+(\d{4})/i);
    if (b) { const mn=M[b[1].toLowerCase()]; if(mn) return `${b[3]}-${mn}-${b[2].padStart(2,'0')}`; }
    const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return fallback;
}

// ── AI extraction ────────────────────────────────────────────────────────────
async function callAI(images: {b64:string;mime:string}[], apiKey: string): Promise<any> {
  const content: any[] = [{
    type: 'text',
    text: `You are reading gas station daily close reports for 24 Seven Mart / Texaco.
Read ALL images carefully. Extract every number exactly as printed.
Return ONLY this JSON (no markdown, no text before/after):

{
  "report_type": "store_close",
  "report_date": null,
  "gross_sales": null,
  "fuel_sales": null,
  "inside_sales": null,
  "non_fuel_sales": null,
  "taxes": null,
  "discounts": null,
  "refunds": null,
  "transactions": null,
  "customers": null,
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
  "lottery_payouts": null,
  "scratch_payouts": null,
  "lottery_settlements": null,
  "lottery_commissions": null,
  "lottery_balance": null,
  "fuel_unleaded_sales": null,
  "fuel_midgrade_sales": null,
  "fuel_premium_sales": null,
  "fuel_diesel_sales": null,
  "fuel_unleaded_gallons": null,
  "fuel_midgrade_gallons": null,
  "fuel_premium_gallons": null,
  "fuel_diesel_gallons": null,
  "department_sales": {},
  "checks_given": [],
  "deliveries": [],
  "tickets_activated": [],
  "safe_drop_list": [],
  "paid_out_list": [],
  "notes": ""
}

EXTRACTION RULES:

REPORT DATE: Always YYYY-MM-DD. "Jun 30 2026"="2026-06-30", "06/30/2026"="2026-06-30", "06,30,2026"="2026-06-30"

REPORT TYPE: store_close | till | lottery | scratch | department | handwritten | fuel_atg | unknown

STORE CLOSE (Grand Total line):
- gross_sales = "Grand Total Store Sales Reading" biggest total
- fuel_sales = "Total Fuel Sales"
- inside_sales = "Non Fuel Sales" 
- taxes = "Total Taxes Collected"
- fuel_unleaded_sales = Grade 01 UNLEAD REG sales
- fuel_midgrade_sales = Grade 02 UNL SUP US sales
- fuel_premium_sales = Grade 03 REG PLS sales
- fuel_diesel_sales = Grade 04 DIESEL #1 sales
- fuel_unleaded_gallons = Grade 01 volume
- check_sales = "Check" row in Method of Payment
- crind_credit = "CRIND CR Local Acct" row
- crind_debit = "Crind DEBIT" row
- discounts = "Other Discounts" or "Fuel Discounts"

TILL REPORT:
- beginning_till = "TILL BEGINNING BALANCE"
- cashier_short = "CASHIER SHORT AMOUNT" (store as positive number)
- cashier_over = "CASHIER OVER AMOUNT" (store as positive number)
- safe_drops = total of all safe drops (Cashier Safe Drops total)
- safe_loans = "SAFE LOANS" amount
- paid_ins = "PAID INS" total
- paid_outs = "PAID OUTS" total (store as positive)
- credit_sales = Credit from CASHIER COUNTED section
- debit_sales = Debit from CASHIER COUNTED section

TEXAS LOTTERY:
- lottery_sales = "DRAW GM NET SALES" or "DRAW GM GROSS SALES"
- scratch_payouts = "SCRATCH CASHES" amount (positive, ignore minus sign)
- lottery_settlements = "SETTLEMENTS" amount
- lottery_commissions = "COMMISSIONS" amount (positive, ignore minus sign)
- lottery_balance = "BALANCE" amount

HANDWRITTEN DAILY REPORT (24/7 Mart Daily Report form):
- safe_drop_list = array of each drop: [{"amount":293,"time":"6:18AM","by":"Shayan"},...]
- safe_drops = sum of all safe drop amounts
- paid_ins = total paid in cash
- paid_outs = total paid out cash
- checks_given = array: [{"number":"4573","payee":"Tylers Ice","amount":829},...]
- deliveries = array: [{"vendor":"Pepsi","amount":681.61},...]
- tickets_activated = array: [{"book":"2739","slot":2,"price":5},...]

DEPARTMENT SALES: {"BEER":820.51,"SNACK":895.47,"SODA":509.62,...} use Gross Sales $ column

Use null for missing fields. Never calculate. Never guess. Read exactly as printed.`
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

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  let raw = (data?.choices?.[0]?.message?.content ?? '').trim()
    .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  const match = raw.match(/\{[\s\S]*/);
  if (!match) throw new Error(`No JSON found. Got: ${raw.slice(0,200)}`);
  let js = match[0];

  try { return JSON.parse(js); } catch {}

  // Recovery: close truncated JSON
  let depth=0, inStr=false, esc=false;
  for (const ch of js) {
    if (esc) { esc=false; continue; }
    if (ch==='\\') { esc=true; continue; }
    if (ch==='"') { inStr=!inStr; continue; }
    if (!inStr) { if(ch==='{'||ch==='[') depth++; else if(ch==='}'||ch===']') depth--; }
  }
  if (inStr) js+='"';
  while (depth > 0) { js+='}'; depth--; }
  try { return JSON.parse(js); } catch { throw new Error(`JSON parse failed`); }
}

// ── Merge extracted data into existing report ────────────────────────────────
function merge(existing: any, u: any): any {
  const n = toNum;
  const keep = (f: string) => n(existing?.[f]) || n(u[f]);
  const sum  = (f: string) => n(existing?.[f]) + n(u[f]);
  const t = (u.report_type||'unknown').toLowerCase();

  const base = { ...existing };

  if (t === 'store_close') {
    return { ...base,
      gross_sales: n(u.gross_sales)||n(base.gross_sales),
      fuel_sales: n(u.fuel_sales)||n(base.fuel_sales),
      inside_sales: n(u.inside_sales)||n(u.non_fuel_sales)||n(base.inside_sales),
      taxes: keep('taxes'), discounts: keep('discounts'), refunds: keep('refunds'),
      transactions: keep('transactions'), customers: keep('customers'),
      cash_sales: n(u.cash_sales)||n(base.cash_sales),
      credit_sales: n(u.credit_sales)+n(u.crind_credit)||n(base.credit_sales),
      debit_sales: n(u.debit_sales)+n(u.crind_debit)||n(base.debit_sales),
      ebt_sales: keep('ebt_sales'),
      check_sales: keep('check_sales'),
      atm_sales: n(u.crind_cash)||n(base.atm_sales),
      fuel_unleaded_sales: keep('fuel_unleaded_sales'), fuel_midgrade_sales: keep('fuel_midgrade_sales'),
      fuel_premium_sales: keep('fuel_premium_sales'), fuel_diesel_sales: keep('fuel_diesel_sales'),
      fuel_unleaded_gallons: keep('fuel_unleaded_gallons'), fuel_midgrade_gallons: keep('fuel_midgrade_gallons'),
      fuel_premium_gallons: keep('fuel_premium_gallons'), fuel_diesel_gallons: keep('fuel_diesel_gallons'),
      department_sales: { ...(base.department_sales||{}), ...(u.department_sales||{}) },
    };
  }

  if (t === 'till') {
    // Multiple till reports merge by summing shorts/overs across registers
    const newShort = n(u.cashier_short);
    const newOver  = n(u.cashier_over);
    const prevShort = n(base.cashier_short);
    const prevOver  = n(base.cashier_over);
    return { ...base,
      beginning_till: keep('beginning_till'),
      safe_drops: n(u.safe_drops)||n(base.safe_drops),
      safe_loans: sum('safe_loans'),
      paid_ins: sum('paid_ins'),
      paid_outs: sum('paid_outs'),
      credit_sales: n(u.credit_sales)+n(base.credit_sales)||n(base.credit_sales),
      debit_sales: n(u.debit_sales)+n(base.debit_sales)||n(base.debit_sales),
      cashier_short: prevShort + newShort,
      cashier_over: prevOver + newOver,
    };
  }

  if (t === 'lottery') {
    return { ...base,
      lottery_sales: keep('lottery_sales'),
      scratch_sales: keep('scratch_sales'),
      lottery_payouts: sum('lottery_payouts'),
      scratch_payouts: n(u.scratch_payouts)||n(base.scratch_payouts),
      lottery_settlement: n(u.lottery_settlements)||n(base.lottery_settlement),
      lottery_commission: n(u.lottery_commissions)||n(base.lottery_commission),
    };
  }

  if (t === 'handwritten') {
    return { ...base,
      safe_drops: n(u.safe_drops)||n(base.safe_drops),
      paid_ins: sum('paid_ins'),
      paid_outs: sum('paid_outs'),
      check_sales: sum('check_sales'),
      checks_given: [...(base.checks_given||[]), ...(u.checks_given||[])],
      deliveries: [...(base.deliveries||[]), ...(u.deliveries||[])],
      tickets_activated: [...(base.tickets_activated||[]), ...(u.tickets_activated||[])],
    };
  }

  if (t === 'department') {
    return { ...base, department_sales: { ...(base.department_sales||{}), ...(u.department_sales||{}) } };
  }

  // Generic merge
  const m = { ...base };
  for (const [k,v] of Object.entries(u)) {
    if (v !== null && v !== 0 && v !== '' && !['report_type','report_date','notes'].includes(k) && !(m as any)[k]) (m as any)[k] = v;
  }
  if (u.department_sales && Object.keys(u.department_sales).length>0)
    m.department_sales = { ...(base.department_sales||{}), ...(u.department_sales||{}) };
  return m;
}

// ── Short/Over calculation — POS is ground truth ─────────────────────────────
function calcShortOver(r: any) {
  const n = toNum;
  // Net short/over across ALL registers
  // cashier_short and cashier_over are summed from all till reports
  const totalShort = n(r.cashier_short);
  const totalOver  = n(r.cashier_over);
  const netShortOver = Math.round((totalOver - totalShort) * 100) / 100;

  // Expected cash from POS
  const beginningTill = n(r.beginning_till);
  const cashSales     = n(r.cash_sales);
  const safeDrops     = n(r.safe_drops);
  const paidOuts      = n(r.paid_outs);
  const paidIns       = n(r.paid_ins);
  const safeLoans     = n(r.safe_loans);

  let expectedCash = n(r.expected_cash);
  if (!expectedCash && (cashSales > 0 || beginningTill > 0)) {
    expectedCash = beginningTill + cashSales - safeDrops - paidOuts + paidIns + safeLoans;
  } else if (!expectedCash && n(r.gross_sales) > 0) {
    const nonCash = n(r.credit_sales)+n(r.debit_sales)+n(r.ebt_sales)+n(r.check_sales)+n(r.atm_sales);
    const estCash = Math.max(0, n(r.gross_sales)-nonCash);
    expectedCash = beginningTill + estCash - safeDrops - paidOuts + paidIns + safeLoans;
  }

  return {
    shortOver: totalShort > 0 || totalOver > 0 ? netShortOver : 0,
    expectedCash,
  };
}

// ── Apply deliveries to inventory ────────────────────────────────────────────
async function applyDeliveries(sb: any, storeId: string, deliveries: any[]) {
  if (!deliveries || deliveries.length === 0) return;

  for (const d of deliveries) {
    const vendor = (d.vendor || d.name || '').trim();
    const amount = toNum(d.amount);
    if (!vendor) continue;

    // Log as a purchase order / invoice from connector
    await sb.from('invoices').insert({
      store_id: storeId,
      vendor_name: vendor,
      total_amount: amount,
      status: 'NEEDS_REVIEW',
      source: 'daily_report',
      invoice_date: new Date().toISOString().split('T')[0],
    }).catch(() => {});
  }
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
    if (!store) return NextResponse.json({ error: 'No store found — complete Setup in Settings' }, { status: 400 });

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

    // AI extraction
    let extracted: any;
    try { extracted = await callAI(images, apiKey); }
    catch (e: any) { return NextResponse.json({ error: `AI extraction failed: ${e.message}` }, { status: 502 }); }

    const today = new Date().toISOString().split('T')[0];
    const reportDate = toDate(extracted.report_date, reportDateOverride || today);
    const reportType = (extracted.report_type || 'unknown').toLowerCase();

    // Save upload record
    let uploadId: string | null = null;
    try {
      const { data: up } = await sb.from('report_uploads').insert({
        store_id: store.id, report_date: reportDate, report_type: reportType,
        file_name: files.map(f => f.name||'photo').join(', '),
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

    // Apply deliveries to invoices queue
    const deliveries = extracted.deliveries || [];
    if (deliveries.length > 0) {
      await applyDeliveries(sb, store.id, deliveries);
    }

    // Build safe payload — every field sanitized
    const checksTotal = (extracted.checks_given || []).reduce((s: number, c: any) => s + toNum(c.amount), 0);

    const payload: Record<string, any> = {
      store_id:             store.id,
      report_date:          reportDate,
      status:               'in_progress',
      gross_sales:          toNum(merged.gross_sales),
      net_sales:            toNum(merged.net_sales),
      fuel_sales:           toNum(merged.fuel_sales),
      inside_sales:         toNum(merged.inside_sales)||toNum(merged.non_fuel_sales),
      merchandise_sales:    toNum(merged.merchandise_sales),
      lottery_sales:        toNum(merged.lottery_sales),
      scratch_sales:        toNum(merged.scratch_sales),
      lottery_payouts:      toNum(merged.lottery_payouts),
      scratch_payouts:      toNum(merged.scratch_payouts),
      lottery_settlement:   toNum(merged.lottery_settlement)||toNum(merged.lottery_settlements),
      lottery_commission:   toNum(merged.lottery_commission)||toNum(merged.lottery_commissions),
      taxes:                toNum(merged.taxes),
      discounts:            toNum(merged.discounts),
      refunds:              toNum(merged.refunds),
      transactions:         Math.round(toNum(merged.transactions)),
      customers:            Math.round(toNum(merged.customers)),
      cash_sales:           toNum(merged.cash_sales),
      credit_sales:         toNum(merged.credit_sales),
      debit_sales:          toNum(merged.debit_sales),
      ebt_sales:            toNum(merged.ebt_sales),
      check_sales:          toNum(merged.check_sales)||checksTotal,
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
      ai_notes:             [
        extracted.notes || null,
        deliveries.length > 0 ? `${deliveries.length} deliveries logged to invoices` : null,
        (extracted.checks_given||[]).length > 0 ? `${(extracted.checks_given||[]).length} checks recorded` : null,
        (extracted.tickets_activated||[]).length > 0 ? `${(extracted.tickets_activated||[]).length} lottery tickets activated` : null,
      ].filter(Boolean).join(' | ') || null,
      updated_at:           new Date().toISOString(),
    };

    let savedReport: any = null;
    if (existing) {
      const { data, error } = await sb.from('daily_reports').update(payload).eq('id', existing.id).select('*').single();
      if (error) return NextResponse.json({ error: `DB update failed: ${error.message}` }, { status: 500 });
      savedReport = data;
    } else {
      const { data, error } = await sb.from('daily_reports').insert(payload).select('*').single();
      if (error) return NextResponse.json({ error: `DB insert failed: ${error.message}` }, { status: 500 });
      savedReport = data;
    }

    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    // Log timeline events
    try {
      if (deliveries.length > 0) {
        await sb.from('timeline_events').insert({ store_id: store.id, event_date: reportDate, type: 'delivery', title: `${deliveries.length} vendor deliveries received`, description: deliveries.map((d:any)=>d.vendor).join(', ') });
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
      needsCashCount: toNum(merged.actual_cash) === 0 && expectedCash > 0,
    });

  } catch (err: any) {
    console.error('scan-daily-report:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
