import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

async function callAI(images: { b64: string; type: string }[], apiKey: string): Promise<any> {
  const content: any[] = [
    {
      type: 'text',
      text: `Read this gas station report. Extract numbers ONLY - never calculate anything yourself.

Return ONLY this JSON (no markdown, no explanation):
{"report_type":"store_close","report_date":null,"register_number":null,"gross_sales":null,"net_sales":null,"fuel_sales":null,"inside_sales":null,"merchandise_sales":null,"lottery_sales":null,"scratch_sales":null,"lottery_payouts":null,"scratch_payouts":null,"taxes":null,"discounts":null,"refunds":null,"transactions":null,"customers":null,"fuel_unleaded_gallons":null,"fuel_midgrade_gallons":null,"fuel_premium_gallons":null,"fuel_diesel_gallons":null,"fuel_unleaded_sales":null,"fuel_midgrade_sales":null,"fuel_premium_sales":null,"fuel_diesel_sales":null,"cash_sales":null,"credit_sales":null,"debit_sales":null,"ebt_sales":null,"check_sales":null,"money_order_sales":null,"atm_amount":null,"safe_drops":null,"safe_loans":null,"paid_ins":null,"paid_outs":null,"beginning_till":null,"ending_till":null,"expected_cash":null,"actual_cash":null,"cash_deposit":null,"drawer_difference":null,"short_over":null,"lottery_settlement":null,"lottery_commission":null,"department_sales":{},"notes":""}

report_type options: store_close, till, lottery, scratch, department, safe_drop, paid_out, paid_in, fuel, register, summary, unknown
Use null for any field not visible. Never guess.`
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
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  const raw = (data?.choices?.[0]?.message?.content ?? '').trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in AI response: ${clean.slice(0,150)}`);
  try { return JSON.parse(match[0]); }
  catch { throw new Error(`Invalid JSON from AI`); }
}

function merge(existing: any, u: any): any {
  const n = (v: any) => Number(v || 0);
  const keep = (f: string) => n(existing[f]) || n(u[f]);
  const sum  = (f: string) => n(existing[f]) + n(u[f]);
  const t = u.report_type || 'unknown';
  if (t === 'store_close' || t === 'summary') {
    return { ...existing, gross_sales: n(u.gross_sales)||n(existing.gross_sales), net_sales: n(u.net_sales)||n(existing.net_sales), fuel_sales: keep('fuel_sales'), inside_sales: keep('inside_sales'), merchandise_sales: keep('merchandise_sales'), taxes: keep('taxes'), discounts: keep('discounts'), refunds: keep('refunds'), transactions: keep('transactions'), customers: keep('customers'), credit_sales: keep('credit_sales'), debit_sales: keep('debit_sales'), ebt_sales: keep('ebt_sales'), check_sales: keep('check_sales') };
  }
  if (t === 'till' || t === 'register') return { ...existing, cash_sales: sum('cash_sales'), safe_drops: sum('safe_drops'), paid_outs: sum('paid_outs'), paid_ins: sum('paid_ins'), actual_cash: sum('actual_cash'), expected_cash: sum('expected_cash'), drawer_difference: sum('drawer_difference'), short_over: sum('short_over'), check_sales: sum('check_sales') };
  if (t === 'lottery') return { ...existing, lottery_sales: sum('lottery_sales'), lottery_payouts: sum('lottery_payouts'), lottery_settlement: keep('lottery_settlement'), lottery_commission: keep('lottery_commission') };
  if (t === 'scratch') return { ...existing, scratch_sales: sum('scratch_sales'), scratch_payouts: sum('scratch_payouts') };
  if (t === 'safe_drop') return { ...existing, safe_drops: sum('safe_drops') };
  if (t === 'paid_out') return { ...existing, paid_outs: sum('paid_outs') };
  if (t === 'paid_in') return { ...existing, paid_ins: sum('paid_ins') };
  if (t === 'fuel') return { ...existing, fuel_sales: keep('fuel_sales'), fuel_unleaded_sales: keep('fuel_unleaded_sales'), fuel_midgrade_sales: keep('fuel_midgrade_sales'), fuel_premium_sales: keep('fuel_premium_sales'), fuel_diesel_sales: keep('fuel_diesel_sales'), fuel_unleaded_gallons: keep('fuel_unleaded_gallons'), fuel_midgrade_gallons: keep('fuel_midgrade_gallons'), fuel_premium_gallons: keep('fuel_premium_gallons'), fuel_diesel_gallons: keep('fuel_diesel_gallons') };
  if (t === 'department') return { ...existing, department_sales: { ...(existing.department_sales||{}), ...(u.department_sales||{}) } };
  const m = { ...existing };
  for (const [k, v] of Object.entries(u)) {
    if (v !== null && v !== 0 && !['report_type','notes','report_date','register_number'].includes(k) && !m[k]) m[k] = v;
  }
  return m;
}

function validate(r: any): string[] {
  const w: string[] = [];
  const n = (v: any) => Number(v || 0);
  const exp = n(r.cash_sales) - n(r.paid_outs) - n(r.safe_drops) + n(r.paid_ins);
  const act = n(r.actual_cash);
  if (act > 0 && exp > 0 && Math.abs(act - exp) > 50) w.push(`Cash doesn't balance: expected $${exp.toFixed(2)}, actual $${act.toFixed(2)}`);
  const gross = n(r.gross_sales);
  const pmts = n(r.cash_sales) + n(r.credit_sales) + n(r.debit_sales) + n(r.ebt_sales) + n(r.check_sales);
  if (gross > 0 && pmts > 0 && Math.abs(gross - pmts) > gross * 0.15) w.push(`Payment methods ($${pmts.toFixed(2)}) don't match gross sales ($${gross.toFixed(2)})`);
  return w;
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY not set in Vercel' }, { status: 500 });

    const formData = await request.formData();
    const storeIdOverride = formData.get('store_id') as string;
    const reportDateOverride = formData.get('report_date') as string;

    let store: { id: string } | null = null;
    if (storeIdOverride) {
      const { data } = await sb.from('stores').select('id').eq('id', storeIdOverride).eq('owner_id', user.id).maybeSingle();
      store = data;
    }
    if (!store) {
      const { data } = await sb.from('stores').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
      store = data;
    }
    if (!store) return NextResponse.json({ error: 'No store found — complete store setup in Settings' }, { status: 400 });

    const files: File[] = [...(formData.getAll('file') as File[]).filter((f: File) => f.size > 0)];
    for (let i = 1; i <= 10; i++) {
      const f = formData.get(`file${i}`) as File | null;
      if (f && f.size > 0) files.push(f);
    }
    if (!files.length) return NextResponse.json({ error: 'No files received' }, { status: 400 });

    const images: { b64: string; type: string }[] = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      images.push({ b64: buf.toString('base64'), type: file.type || 'image/jpeg' });
    }

    let extracted: any;
    try { extracted = await callAI(images, apiKey); }
    catch (e: any) { return NextResponse.json({ error: `AI extraction failed: ${e.message}` }, { status: 502 }); }

    const reportType = extracted.report_type || 'unknown';
    const reportDate = extracted.report_date || reportDateOverride || new Date().toISOString().split('T')[0];
    const n = (v: any) => Number(v || 0);

    // Save upload record — use try/catch instead of .catch() on chain
    let uploadId: string | null = null;
    try {
      const { data: uploadData } = await sb.from('report_uploads').insert({
        store_id: store.id,
        report_date: reportDate,
        report_type: reportType,
        file_name: files.map((f: File) => f.name).join(', '),
        status: 'completed',
        raw_extraction: extracted,
        parsed_data: extracted,
        ai_notes: extracted.notes || null,
        processed_at: new Date().toISOString(),
      }).select('id').single();
      uploadId = uploadData?.id ?? null;
    } catch { /* table may not exist yet — safe to continue */ }

    // Get or create daily report
    const { data: existing } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', reportDate).maybeSingle();
    const merged = merge(existing || {}, extracted);
    const warnings = validate(merged);

    const expectedCash = n(merged.expected_cash) || (n(merged.cash_sales) - n(merged.paid_outs) - n(merged.safe_drops) + n(merged.paid_ins));
    const actualCash   = n(merged.actual_cash);
    const shortOver    = n(merged.short_over) || n(merged.drawer_difference) || (actualCash > 0 && expectedCash > 0 ? actualCash - expectedCash : 0);

    const payload = {
      store_id: store.id, report_date: reportDate, status: 'in_progress',
      gross_sales: n(merged.gross_sales), net_sales: n(merged.net_sales),
      fuel_sales: n(merged.fuel_sales) || n(merged.fuel_unleaded_sales)+n(merged.fuel_midgrade_sales)+n(merged.fuel_premium_sales)+n(merged.fuel_diesel_sales),
      inside_sales: n(merged.inside_sales), merchandise_sales: n(merged.merchandise_sales),
      lottery_sales: n(merged.lottery_sales), scratch_sales: n(merged.scratch_sales),
      lottery_payouts: n(merged.lottery_payouts), scratch_payouts: n(merged.scratch_payouts),
      taxes: n(merged.taxes), discounts: n(merged.discounts), refunds: n(merged.refunds),
      transactions: n(merged.transactions), customers: n(merged.customers),
      fuel_unleaded_gallons: n(merged.fuel_unleaded_gallons), fuel_midgrade_gallons: n(merged.fuel_midgrade_gallons),
      fuel_premium_gallons: n(merged.fuel_premium_gallons), fuel_diesel_gallons: n(merged.fuel_diesel_gallons),
      fuel_unleaded_sales: n(merged.fuel_unleaded_sales), fuel_midgrade_sales: n(merged.fuel_midgrade_sales),
      fuel_premium_sales: n(merged.fuel_premium_sales), fuel_diesel_sales: n(merged.fuel_diesel_sales),
      department_sales: merged.department_sales || {},
      cash_sales: n(merged.cash_sales), credit_sales: n(merged.credit_sales),
      debit_sales: n(merged.debit_sales), ebt_sales: n(merged.ebt_sales),
      check_sales: n(merged.check_sales), money_order_sales: n(merged.money_order_sales),
      atm_sales: n(merged.atm_amount),
      safe_drops: n(merged.safe_drops), safe_loans: n(merged.safe_loans),
      paid_ins: n(merged.paid_ins), paid_outs: n(merged.paid_outs),
      beginning_till: n(merged.beginning_till), ending_till: n(merged.ending_till),
      expected_cash: expectedCash, actual_cash: actualCash, cash_deposit: n(merged.cash_deposit),
      drawer_difference: shortOver,
      lottery_settlement: n(merged.lottery_settlement), lottery_commission: n(merged.lottery_commission),
      validation_warnings: warnings, ai_validated: warnings.length === 0,
      ai_notes: extracted.notes || null, updated_at: new Date().toISOString(),
    };

    let savedReport: any = null;
    if (existing) {
      const { data } = await sb.from('daily_reports').update(payload).eq('id', existing.id).select('*').single();
      savedReport = data;
    } else {
      const { data } = await sb.from('daily_reports').insert(payload).select('*').single();
      savedReport = data;
    }

    // Link upload to report
    if (uploadId && savedReport) {
      try { await sb.from('report_uploads').update({ daily_report_id: savedReport.id }).eq('id', uploadId); } catch {}
    }

    return NextResponse.json({ success: true, report: savedReport, reportType, reportDate, warnings, hasWarnings: warnings.length > 0 });

  } catch (err: any) {
    console.error('scan-daily-report:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
