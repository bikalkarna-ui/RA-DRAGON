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
      text: `You are reading gas station store closing documents. These may include:
- Store Close report (summary with Grand Total, Fuel Sales, Non-Fuel Sales, payment methods like Cash/Credit/Debit/Check/CRIND)
- Till Report (register tape with Cash, Credit, Debit, Safe Drops, Paid Outs, Short amount)
- Texas Lottery report (Gross Sales, Net Sales, Scratch Cashes, Settlements, Commissions, Balance)
- Fuel ATG delivery report (Gross Increase, Net Increase gallons)
- Handwritten daily report (Safe Drop amounts, check numbers, deliveries received)
- Scratch-off count sheet (book numbers, prices)
- Department Sales report (dept names with gross sales amounts)
- Tax Collection report

Read ALL numbers exactly as printed. Never calculate. Never guess. If unclear, use null.

Return ONLY this exact JSON with no markdown, no text before or after:
{"report_type":"store_close","report_date":null,"register_number":null,"operator_name":null,"store_number":null,
"gross_sales":null,"net_sales":null,"total_revenue":null,"network_revenue":null,
"fuel_sales":null,"fuel_unleaded_sales":null,"fuel_midgrade_sales":null,"fuel_premium_sales":null,"fuel_diesel_sales":null,
"fuel_unleaded_gallons":null,"fuel_midgrade_gallons":null,"fuel_premium_gallons":null,"fuel_diesel_gallons":null,"fuel_total_gallons":null,
"fuel_discounts":null,"non_fuel_sales":null,"inside_sales":null,"merchandise_sales":null,
"lottery_sales":null,"lottery_net_sales":null,"scratch_sales":null,"lottery_payouts":null,"scratch_payouts":null,
"lottery_settlements":null,"lottery_commissions":null,"lottery_balance":null,
"taxes":null,"discounts":null,"refunds":null,"transactions":null,"customers":null,
"cash_sales":null,"credit_sales":null,"debit_sales":null,"ebt_sales":null,"check_sales":null,
"crind_credit":null,"crind_debit":null,"money_order_sales":null,"atm_amount":null,
"safe_drops":null,"safe_loans":null,"paid_ins":null,"paid_outs":null,
"beginning_till":null,"ending_till":null,"expected_cash":null,"actual_cash":null,
"cash_deposit":null,"drawer_difference":null,"cashier_short":null,
"delivery_gallons":null,"atg_start_gallons":null,"atg_end_gallons":null,
"department_sales":{},"notes":""}

IMPORTANT RULES:
- report_type: use store_close, till, lottery, scratch, department, safe_drop, paid_out, paid_in, fuel_atg, handwritten, tax, or unknown
- report_date: extract date as YYYY-MM-DD. If you see "Jun 29 2026" write "2026-06-29". If "06/28/26" write "2026-06-28"
- For Store Close: gross_sales = Grand Total Store Sales Reading
- For Till: cashier_short is the "CASHIER SHORT AMOUNT", beginning_till is "TILL BEGINNING BALANCE"
- For Lottery: lottery_settlements, lottery_commissions, lottery_balance from the settlement section
- For CRIND (pay-at-pump): put in crind_credit and crind_debit fields
- For checks: put in check_sales
- Department sales: put each dept name and amount in department_sales object like {"BEER": 875.66, "SNACK": 439.49}
- Handwritten reports: extract safe drop amounts, check payee/amounts, delivery info into notes`
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
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0,200)}`);
  }
  const data = await res.json();
  const raw = (data?.choices?.[0]?.message?.content ?? '').trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in AI response. Got: ${clean.slice(0,200)}`);
  try { return JSON.parse(match[0]); }
  catch { throw new Error(`JSON parse failed: ${match[0].slice(0,100)}`); }
}

function merge(existing: any, u: any): any {
  const n = (v: any) => Number(v || 0);
  const keep = (f: string) => n(existing[f]) || n(u[f]);
  const sum  = (f: string) => n(existing[f]) + n(u[f]);
  const t = u.report_type || 'unknown';

  if (t === 'store_close') {
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
      cash_sales: n(u.cash_sales) || n(existing.cash_sales),
      credit_sales: n(u.credit_sales) || n(existing.credit_sales),
      debit_sales: n(u.debit_sales) || n(existing.debit_sales),
      ebt_sales: keep('ebt_sales'),
      check_sales: keep('check_sales'),
      crind_credit: keep('crind_credit'),
      crind_debit: keep('crind_debit'),
    };
  }
  if (t === 'till') {
    return {
      ...existing,
      cash_sales: sum('cash_sales'),
      credit_sales: sum('credit_sales'),
      debit_sales: sum('debit_sales'),
      safe_drops: sum('safe_drops'),
      paid_outs: sum('paid_outs'),
      paid_ins: sum('paid_ins'),
      actual_cash: sum('actual_cash'),
      expected_cash: sum('expected_cash'),
      beginning_till: sum('beginning_till'),
      drawer_difference: n(u.cashier_short) ? -n(u.cashier_short) : sum('drawer_difference'),
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

    // Calculate short/over
    const expectedCash = n(merged.expected_cash) || (n(merged.cash_sales) - n(merged.paid_outs) - n(merged.safe_drops) + n(merged.paid_ins));
    const actualCash   = n(merged.actual_cash);
    const shortOver    = n(merged.drawer_difference) || (actualCash > 0 && expectedCash > 0 ? actualCash - expectedCash : 0);

    // Build total credit (include CRIND)
    const totalCredit = n(merged.credit_sales) + n(merged.crind_credit);
    const totalDebit  = n(merged.debit_sales)  + n(merged.crind_debit);

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
