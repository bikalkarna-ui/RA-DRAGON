import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

// Report type detection and parsing rules
const REPORT_TYPE_PROMPT = `You are analyzing a gas station daily report image. 

First, identify the report type from these options:
- store_close: Store closing/daily summary report
- till: Cash drawer/till report for a specific register
- lottery: Lottery sales report (pull tabs, lotto, powerball)
- scratch: Scratch-off ticket sales report
- department: Department sales breakdown
- safe_drop: Safe drop record
- paid_out: Paid out record
- paid_in: Paid in/safe loan record
- plu: PLU/product sales report
- register: Register detail report
- fuel: Fuel sales report
- summary: Sales summary report
- unknown: Cannot determine type

Then extract ALL numbers you can see. Be extremely precise - never calculate, only read.

Return ONLY this JSON structure:
{
  "report_type": "store_close",
  "report_date": "2026-06-28",
  "register_number": null,
  "confidence": 0.95,
  
  "gross_sales": null,
  "net_sales": null,
  "fuel_sales": null,
  "inside_sales": null,
  "merchandise_sales": null,
  
  "lottery_sales": null,
  "scratch_sales": null,
  "lottery_payouts": null,
  "scratch_payouts": null,
  
  "taxes": null,
  "discounts": null,
  "refunds": null,
  "transactions": null,
  "customers": null,
  
  "fuel_unleaded_gallons": null,
  "fuel_midgrade_gallons": null,
  "fuel_premium_gallons": null,
  "fuel_diesel_gallons": null,
  "fuel_unleaded_sales": null,
  "fuel_midgrade_sales": null,
  "fuel_premium_sales": null,
  "fuel_diesel_sales": null,
  
  "cash_sales": null,
  "credit_sales": null,
  "debit_sales": null,
  "ebt_sales": null,
  "check_sales": null,
  "money_order_sales": null,
  "atm_amount": null,
  
  "safe_drops": null,
  "safe_loans": null,
  "paid_ins": null,
  "paid_outs": null,
  "beginning_till": null,
  "ending_till": null,
  "expected_cash": null,
  "actual_cash": null,
  "cash_deposit": null,
  "drawer_difference": null,
  
  "lottery_settlement": null,
  "lottery_commission": null,
  
  "department_sales": {},
  
  "notes": ""
}

IMPORTANT RULES:
- Use null for any field you cannot clearly read - never guess
- Do NOT calculate anything - only read what's printed
- Cash ≠ Credit ≠ Debit - keep them separate  
- Safe drops are NOT cash sales
- Lottery payouts are NOT merchandise sales
- Taxes are separate from net sales
- If you see register number, extract it`;

async function callAI(images: { b64: string; type: string }[], apiKey: string): Promise<any> {
  const content: any[] = [{ type: 'text', text: REPORT_TYPE_PROMPT }];
  
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
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content }] }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`AI error ${res.status}: ${raw.slice(0, 200)}`);
  
  const data = JSON.parse(raw);
  const text = data?.choices?.[0]?.message?.content ?? '';
  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  
  try { return JSON.parse(clean); }
  catch { throw new Error('AI returned invalid JSON'); }
}

function mergeIntoDaily(existing: any, upload: any): any {
  const n = (v: any) => Number(v || 0);
  
  // For fields that should be summed (multiple registers, multiple till reports)
  const sum = (field: string) => n(existing[field]) + n(upload[field]);
  
  // For fields that should take the MAX (store-level figures)
  const max = (field: string) => Math.max(n(existing[field]), n(upload[field]));
  
  // For fields where we trust store_close over till reports
  const prefer_nonzero = (field: string) => n(existing[field]) || n(upload[field]);
  
  const type = upload.report_type;
  
  if (type === 'store_close' || type === 'summary') {
    // Store close is authoritative for sales figures
    return {
      ...existing,
      gross_sales: n(upload.gross_sales) || n(existing.gross_sales),
      net_sales: n(upload.net_sales) || n(existing.net_sales),
      fuel_sales: prefer_nonzero('fuel_sales'),
      inside_sales: prefer_nonzero('inside_sales'),
      merchandise_sales: prefer_nonzero('merchandise_sales'),
      taxes: prefer_nonzero('taxes'),
      discounts: prefer_nonzero('discounts'),
      refunds: prefer_nonzero('refunds'),
      transactions: prefer_nonzero('transactions'),
      customers: prefer_nonzero('customers'),
      credit_sales: prefer_nonzero('credit_sales'),
      debit_sales: prefer_nonzero('debit_sales'),
      ebt_sales: prefer_nonzero('ebt_sales'),
    };
  }
  
  if (type === 'till' || type === 'register') {
    // Till reports sum up (multiple registers)
    return {
      ...existing,
      cash_sales: sum('cash_sales'),
      safe_drops: sum('safe_drops'),
      paid_outs: sum('paid_outs'),
      paid_ins: sum('paid_ins'),
      actual_cash: sum('actual_cash'),
      expected_cash: sum('expected_cash'),
      drawer_difference: sum('drawer_difference'),
    };
  }
  
  if (type === 'lottery' || type === 'scratch') {
    return {
      ...existing,
      lottery_sales: sum('lottery_sales'),
      scratch_sales: sum('scratch_sales'),
      lottery_payouts: sum('lottery_payouts'),
      scratch_payouts: sum('scratch_payouts'),
      lottery_settlement: prefer_nonzero('lottery_settlement'),
      lottery_commission: prefer_nonzero('lottery_commission'),
    };
  }
  
  if (type === 'safe_drop') {
    return { ...existing, safe_drops: sum('safe_drops') };
  }
  
  if (type === 'paid_out') {
    return { ...existing, paid_outs: sum('paid_outs') };
  }
  
  if (type === 'paid_in') {
    return { ...existing, paid_ins: sum('paid_ins') };
  }
  
  if (type === 'fuel') {
    return {
      ...existing,
      fuel_sales: prefer_nonzero('fuel_sales'),
      fuel_unleaded_sales: prefer_nonzero('fuel_unleaded_sales'),
      fuel_midgrade_sales: prefer_nonzero('fuel_midgrade_sales'),
      fuel_premium_sales: prefer_nonzero('fuel_premium_sales'),
      fuel_diesel_sales: prefer_nonzero('fuel_diesel_sales'),
      fuel_unleaded_gallons: prefer_nonzero('fuel_unleaded_gallons'),
      fuel_midgrade_gallons: prefer_nonzero('fuel_midgrade_gallons'),
      fuel_premium_gallons: prefer_nonzero('fuel_premium_gallons'),
      fuel_diesel_gallons: prefer_nonzero('fuel_diesel_gallons'),
    };
  }
  
  if (type === 'department') {
    return {
      ...existing,
      department_sales: { ...(existing.department_sales || {}), ...(upload.department_sales || {}) },
    };
  }
  
  // Unknown type - merge all non-null fields
  const merged = { ...existing };
  for (const [key, val] of Object.entries(upload)) {
    if (val !== null && val !== 0 && key !== 'report_type' && key !== 'notes' && key !== 'confidence') {
      if (!merged[key] || merged[key] === 0) merged[key] = val;
    }
  }
  return merged;
}

function validateReport(report: any): string[] {
  const warnings: string[] = [];
  const n = (v: any) => Number(v || 0);
  
  // Cash balance check
  const expectedCash = n(report.cash_sales) - n(report.paid_outs) - n(report.safe_drops) + n(report.paid_ins);
  const actualCash = n(report.actual_cash);
  if (actualCash > 0 && expectedCash > 0) {
    const diff = Math.abs(actualCash - expectedCash);
    if (diff > 50) warnings.push(`Cash doesn't balance: expected ${expectedCash.toFixed(2)}, actual ${actualCash.toFixed(2)}, difference $${diff.toFixed(2)}`);
  }
  
  // Sales sanity check
  const grossSales = n(report.gross_sales);
  if (grossSales > 0) {
    const cashPlusCard = n(report.cash_sales) + n(report.credit_sales) + n(report.debit_sales) + n(report.ebt_sales);
    if (cashPlusCard > 0 && Math.abs(grossSales - cashPlusCard) > grossSales * 0.1) {
      warnings.push(`Payment methods (${cashPlusCard.toFixed(2)}) don't match gross sales (${grossSales.toFixed(2)})`);
    }
  }
  
  return warnings;
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found' }, { status: 400 });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });

    const formData = await request.formData();
    const reportDateStr = formData.get('report_date') as string || new Date().toISOString().split('T')[0];
    const storeIdOverride = formData.get('store_id') as string;
    const storeId = storeIdOverride || store.id;

    // Collect files
    const files: File[] = [...(formData.getAll('file') as File[]).filter((f: File) => f.size > 0)];
    for (let i = 1; i <= 10; i++) {
      const f = formData.get(`file${i}`) as File | null;
      if (f && f.size > 0) files.push(f);
    }
    if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });

    // Convert to base64
    const images: { b64: string; type: string }[] = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      images.push({ b64: buf.toString('base64'), type: file.type || 'image/jpeg' });
    }

    // Run AI extraction
    let extracted: any;
    try {
      extracted = await callAI(images, apiKey);
    } catch (e: any) {
      return NextResponse.json({ error: `AI extraction failed: ${e.message}` }, { status: 502 });
    }

    const reportType = extracted.report_type || 'unknown';
    const reportDate = extracted.report_date || reportDateStr;

    // Save upload record
    const { data: upload } = await sb.from('report_uploads').insert({
      store_id: storeId,
      report_date: reportDate,
      report_type: reportType,
      file_name: files.map(f => f.name).join(', '),
      file_size: files.reduce((s, f) => s + f.size, 0),
      status: 'completed',
      raw_extraction: extracted,
      parsed_data: extracted,
      ai_notes: extracted.notes || null,
      processed_at: new Date().toISOString(),
    }).select('id').single();

    // Get or create daily report for this date
    let { data: dailyReport } = await sb
      .from('daily_reports')
      .select('*')
      .eq('store_id', storeId)
      .eq('report_date', reportDate)
      .maybeSingle();

    let currentData = dailyReport || {};
    const mergedData = mergeIntoDaily(currentData, extracted);
    const warnings = validateReport(mergedData);

    const n = (v: any) => Number(v || 0);
    const reportPayload = {
      store_id: storeId,
      report_date: reportDate,
      status: 'in_progress',
      gross_sales: n(mergedData.gross_sales),
      net_sales: n(mergedData.net_sales),
      fuel_sales: n(mergedData.fuel_sales) || n(mergedData.fuel_unleaded_sales) + n(mergedData.fuel_midgrade_sales) + n(mergedData.fuel_premium_sales) + n(mergedData.fuel_diesel_sales),
      inside_sales: n(mergedData.inside_sales),
      merchandise_sales: n(mergedData.merchandise_sales),
      lottery_sales: n(mergedData.lottery_sales),
      scratch_sales: n(mergedData.scratch_sales),
      lottery_payouts: n(mergedData.lottery_payouts),
      scratch_payouts: n(mergedData.scratch_payouts),
      taxes: n(mergedData.taxes),
      discounts: n(mergedData.discounts),
      refunds: n(mergedData.refunds),
      transactions: n(mergedData.transactions),
      customers: n(mergedData.customers),
      fuel_unleaded_gallons: n(mergedData.fuel_unleaded_gallons),
      fuel_midgrade_gallons: n(mergedData.fuel_midgrade_gallons),
      fuel_premium_gallons: n(mergedData.fuel_premium_gallons),
      fuel_diesel_gallons: n(mergedData.fuel_diesel_gallons),
      fuel_unleaded_sales: n(mergedData.fuel_unleaded_sales),
      fuel_midgrade_sales: n(mergedData.fuel_midgrade_sales),
      fuel_premium_sales: n(mergedData.fuel_premium_sales),
      fuel_diesel_sales: n(mergedData.fuel_diesel_sales),
      department_sales: mergedData.department_sales || {},
      cash_sales: n(mergedData.cash_sales),
      credit_sales: n(mergedData.credit_sales),
      debit_sales: n(mergedData.debit_sales),
      ebt_sales: n(mergedData.ebt_sales),
      check_sales: n(mergedData.check_sales),
      money_order_sales: n(mergedData.money_order_sales),
      atm_sales: n(mergedData.atm_amount),
      safe_drops: n(mergedData.safe_drops),
      safe_loans: n(mergedData.safe_loans),
      paid_ins: n(mergedData.paid_ins),
      paid_outs: n(mergedData.paid_outs),
      beginning_till: n(mergedData.beginning_till),
      ending_till: n(mergedData.ending_till),
      expected_cash: n(mergedData.expected_cash) || n(mergedData.cash_sales) - n(mergedData.paid_outs) - n(mergedData.safe_drops) + n(mergedData.paid_ins),
      actual_cash: n(mergedData.actual_cash),
      cash_deposit: n(mergedData.cash_deposit),
      drawer_difference: n(mergedData.drawer_difference) || n(mergedData.actual_cash) - (n(mergedData.expected_cash) || n(mergedData.cash_sales) - n(mergedData.paid_outs) - n(mergedData.safe_drops) + n(mergedData.paid_ins)),
      lottery_settlement: n(mergedData.lottery_settlement),
      lottery_commission: n(mergedData.lottery_commission),
      validation_warnings: warnings,
      ai_validated: warnings.length === 0,
      ai_notes: extracted.notes || null,
      updated_at: new Date().toISOString(),
    };

    let savedReport;
    if (dailyReport) {
      const { data } = await sb.from('daily_reports').update(reportPayload).eq('id', dailyReport.id).select('*').single();
      savedReport = data;
    } else {
      const { data } = await sb.from('daily_reports').insert(reportPayload).select('*').single();
      savedReport = data;
    }

    // Link upload to daily report
    if (upload && savedReport) {
      await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', upload.id);
    }

    // Save register report if it's a till
    if ((reportType === 'till' || reportType === 'register') && savedReport) {
      await sb.from('register_reports').insert({
        store_id: storeId,
        daily_report_id: savedReport.id,
        report_date: reportDate,
        register_number: extracted.register_number || '1',
        gross_sales: n(extracted.gross_sales),
        net_sales: n(extracted.net_sales),
        cash_sales: n(extracted.cash_sales),
        credit_sales: n(extracted.credit_sales),
        debit_sales: n(extracted.debit_sales),
        ebt_sales: n(extracted.ebt_sales),
        expected_cash: n(extracted.expected_cash),
        actual_cash: n(extracted.actual_cash),
        drawer_difference: n(extracted.drawer_difference),
        safe_drops: n(extracted.safe_drops),
        paid_outs: n(extracted.paid_outs),
        paid_ins: n(extracted.paid_ins),
        transactions: n(extracted.transactions),
      });
    }

    return NextResponse.json({
      success: true,
      report: savedReport,
      uploadId: upload?.id,
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
