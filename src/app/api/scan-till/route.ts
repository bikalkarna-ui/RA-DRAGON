import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Fast model - claude-haiku is 10x faster for extraction
const MODEL = 'anthropic/claude-haiku-4-5-20251001';

async function callAI(images: { b64: string; type: string }[], apiKey: string): Promise<any> {
  const content: any[] = [
    {
      type: 'text',
      text: `Extract ALL numbers from this convenience store close-till / daily sales report. Return ONLY valid JSON, no markdown, no explanation:
{
  "cash_counted":0,"checks_counted":0,"atm_total":0,
  "cash_sales":0,"credit_sales":0,"debit_sales":0,"ebt_sales":0,"check_sales":0,"mobile_sales":0,
  "mac_payout":0,"lotto_paid":0,"lottery_paid":0,"purchase_paid":0,
  "dept_tax":0,"dept_nontax":0,"dept_cig":0,"dept_beer_wine":0,"dept_novelty":0,"dept_vape":0,"dept_unknown_upc":0,
  "lotto_sales":0,"lottery_sales":0,"money_order_sales":0,"money_order_fee":0,
  "fuel_unleaded_gallons":0,"fuel_midgrade_gallons":0,"fuel_premium_gallons":0,"fuel_diesel_gallons":0,
  "fuel_unleaded_sales":0,"fuel_midgrade_sales":0,"fuel_premium_sales":0,"fuel_diesel_sales":0,
  "store_deposit":0,"vendor_activities":[],"atg_unleaded":0,"atg_midgrade":0,"atg_premium":0,"atg_diesel":0,"notes":""
}
Use 0 for missing fields. Extract EVERY number you see.`
    }
  ];

  // Add all images
  for (const img of images) {
    if (img.type === 'application/pdf') {
      content.push({ type: 'file', file: { filename: 'report.pdf', file_data: `data:${img.type};base64,${img.b64}` } });
    } else {
      content.push({ type: 'image_url', image_url: { url: `data:${img.type};base64,${img.b64}` } });
    }
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://ra-solution.app' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'user', content }] }),
  });

  if (!res.ok) throw new Error(`AI failed: ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  return JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim());
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found' }, { status: 400 });

    const formData = await request.formData();
    const employeeName = (formData.get('employee_name') as string) || 'Unknown';
    const employeeId = (formData.get('employee_id') as string) || null;
    const manualDataStr = formData.get('manual_data') as string | null;

    const admin = createAdminClient();
    const apiKey = process.env.OPENROUTER_API_KEY;

    let parsed: any = {};

    if (manualDataStr) {
      // Manual form entry — no AI needed
      try { parsed = JSON.parse(manualDataStr); } catch { parsed = {}; }
    } else {
      // Collect ALL uploaded files (multi-page support)
      const images: { b64: string; type: string }[] = [];
      const files = formData.getAll('file') as File[];
      // Also check file0, file1, file2... pattern
      for (let i = 0; i < 10; i++) {
        const f = formData.get(`file${i}`) as File | null;
        if (f && f.size > 0) files.push(f);
      }

      if (files.length === 0) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      // Convert all files to base64
      for (const file of files) {
        const buf = Buffer.from(await file.arrayBuffer());
        images.push({ b64: buf.toString('base64'), type: file.type });

        // Try to save file to storage (non-blocking — don't fail if bucket missing)
        try {
          const ext = file.name.split('.').pop() || 'jpg';
          await admin.storage.from('till_readings').upload(`${store.id}/${crypto.randomUUID()}.${ext}`, buf, { contentType: file.type });
        } catch { /* storage bucket may not exist yet — that's ok */ }
      }

      if (!apiKey) {
        return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured in environment variables' }, { status: 500 });
      }

      try {
        parsed = await callAI(images, apiKey);
      } catch (aiErr: any) {
        return NextResponse.json({ error: `AI extraction failed: ${aiErr.message}` }, { status: 502 });
      }
    }

    const n = (v: any) => Math.round((parseFloat(v) || 0) * 100) / 100;

    // Calculate totals
    const totalPayouts = n(parsed.mac_payout) + n(parsed.lotto_paid) + n(parsed.lottery_paid) + n(parsed.purchase_paid);
    const cashExpected = n(parsed.cash_sales) - totalPayouts;
    const cashActual = n(parsed.cash_counted);
    const shortOver = cashActual - cashExpected;

    const totalFuelSales = n(parsed.fuel_unleaded_sales) + n(parsed.fuel_midgrade_sales) + n(parsed.fuel_premium_sales) + n(parsed.fuel_diesel_sales);
    const totalDeptSales = n(parsed.dept_tax) + n(parsed.dept_nontax) + n(parsed.dept_cig) + n(parsed.dept_beer_wine) + n(parsed.dept_novelty) + n(parsed.dept_vape) + n(parsed.dept_unknown_upc);
    const totalSales = totalDeptSales + totalFuelSales + n(parsed.lotto_sales) + n(parsed.lottery_sales) + n(parsed.money_order_sales) + n(parsed.money_order_fee);

    const tillData = {
      store_id: store.id,
      employee_name: employeeName,
      employee_id: employeeId || null,
      reading_date: new Date().toISOString().split('T')[0],
      cash_counted: n(parsed.cash_counted), checks_counted: n(parsed.checks_counted),
      cash_sales: n(parsed.cash_sales), credit_sales: n(parsed.credit_sales),
      debit_sales: n(parsed.debit_sales), ebt_sales: n(parsed.ebt_sales),
      check_sales: n(parsed.check_sales), mobile_sales: n(parsed.mobile_sales),
      atm_total: n(parsed.atm_total),
      mac_payout: n(parsed.mac_payout), lotto_paid: n(parsed.lotto_paid),
      lottery_paid: n(parsed.lottery_paid), purchase_paid: n(parsed.purchase_paid),
      dept_tax: n(parsed.dept_tax), dept_nontax: n(parsed.dept_nontax),
      dept_cig: n(parsed.dept_cig), dept_beer_wine: n(parsed.dept_beer_wine),
      dept_novelty: n(parsed.dept_novelty), dept_vape: n(parsed.dept_vape),
      dept_unknown_upc: n(parsed.dept_unknown_upc),
      fuel_unleaded_gallons: n(parsed.fuel_unleaded_gallons), fuel_midgrade_gallons: n(parsed.fuel_midgrade_gallons),
      fuel_premium_gallons: n(parsed.fuel_premium_gallons), fuel_diesel_gallons: n(parsed.fuel_diesel_gallons),
      fuel_unleaded_sales: n(parsed.fuel_unleaded_sales), fuel_midgrade_sales: n(parsed.fuel_midgrade_sales),
      fuel_premium_sales: n(parsed.fuel_premium_sales), fuel_diesel_sales: n(parsed.fuel_diesel_sales),
      lotto_sales: n(parsed.lotto_sales), lottery_sales: n(parsed.lottery_sales),
      money_order_sales: n(parsed.money_order_sales), money_order_fee: n(parsed.money_order_fee),
      raw_ai_response: parsed,
      notes: parsed.notes || null,
    };

    // Save till reading
    let tillId: string | null = null;
    try {
      const { data: till, error: tillErr } = await admin.from('till_readings').insert(tillData).select('id').single();
      if (tillErr) throw tillErr;
      tillId = till?.id ?? null;
    } catch (dbErr: any) {
      // Table might not exist yet
      return NextResponse.json({ error: `Database error: ${dbErr.message}. Please run schema.sql in Supabase.` }, { status: 500 });
    }

    // Aggregate ALL till readings for today to build daily close report
    const today = new Date().toISOString().split('T')[0];
    const { data: allTills } = await admin.from('till_readings').select('*').eq('store_id', store.id).eq('reading_date', today);
    const tills = allTills ?? [];
    const sum = (f: string) => tills.reduce((s: number, t: any) => s + Number(t[f] || 0), 0);

    const totalCashSales = sum('cash_sales');
    const totalCreditSales = sum('credit_sales');
    const totalDebitSales = sum('debit_sales');
    const totalEbtSales = sum('ebt_sales');
    const totalCheckSales = sum('check_sales');
    const allMacPayout = sum('mac_payout');
    const allLottoPaid = sum('lotto_paid');
    const allLotteryPaid = sum('lottery_paid');
    const allPurchasePaid = sum('purchase_paid');
    const allPayouts = allMacPayout + allLottoPaid + allLotteryPaid + allPurchasePaid;
    const cashExpectedDay = totalCashSales - allPayouts;
    const cashActualDay = sum('cash_counted');
    const shortOverDay = cashActualDay - cashExpectedDay;
    const totalSalesDay = sum('dept_tax') + sum('dept_nontax') + sum('dept_cig') + sum('dept_beer_wine') + sum('dept_novelty') + sum('dept_vape') + sum('dept_unknown_upc') + sum('fuel_unleaded_sales') + sum('fuel_midgrade_sales') + sum('fuel_premium_sales') + sum('fuel_diesel_sales') + sum('lotto_sales') + sum('lottery_sales') + sum('money_order_sales') + sum('money_order_fee');
    const totalIn = totalCashSales + totalCreditSales + totalDebitSales + totalEbtSales + totalCheckSales;
    const vendorActivities = tills.flatMap((t: any) => Array.isArray(t.raw_ai_response?.vendor_activities) ? t.raw_ai_response.vendor_activities : []);
    const lastTill = tills[tills.length - 1] ?? {};

    const reportData = {
      store_id: store.id, report_date: today,
      atm_total: sum('atm_total'), checks_total: sum('checks_counted'),
      cash_in_drawer: cashActualDay, net_cash: cashActualDay - sum('atm_total'),
      total_cash_flow: totalIn,
      cash_expected: cashExpectedDay, cash_actual: cashActualDay, short_over: shortOverDay,
      dept_tax: sum('dept_tax'), dept_nontax: sum('dept_nontax'), dept_cig: sum('dept_cig'),
      dept_beer_wine: sum('dept_beer_wine'), dept_novelty: sum('dept_novelty'),
      dept_vape: sum('dept_vape'), dept_unknown_upc: sum('dept_unknown_upc'),
      total_sales: totalSalesDay,
      lotto_sales: sum('lotto_sales'), lottery_sales: sum('lottery_sales'),
      fuel_unleaded: sum('fuel_unleaded_sales'), fuel_midgrade: sum('fuel_midgrade_sales'),
      fuel_premium: sum('fuel_premium_sales'), fuel_diesel: sum('fuel_diesel_sales'),
      money_order_sales: sum('money_order_sales'), money_order_fee: sum('money_order_fee'),
      sales_tax_collected: sum('dept_tax'),
      credit_card_total: totalCreditSales, ebt_total: totalEbtSales,
      check_total: totalCheckSales, coupon_total: 0,
      mac_payout: allMacPayout, purchase_paid: allPurchasePaid,
      lotto_paid: allLottoPaid, lottery_paid: allLotteryPaid,
      total_in: totalIn, total_out: allPayouts,
      gross: totalSalesDay, net: totalSalesDay - allPayouts,
      day_close_total_in: totalIn, day_close_total_out: allPayouts,
      mac_in: sum('atm_total'), mac_out: allMacPayout,
      store_deposit: cashActualDay, mac_deposit: 0, total_deposit: cashActualDay,
      atg_unleaded: Number(lastTill.fuel_unleaded_gallons || 0),
      atg_midgrade: Number(lastTill.fuel_midgrade_gallons || 0),
      atg_premium: Number(lastTill.fuel_premium_gallons || 0),
      atg_diesel: Number(lastTill.fuel_diesel_gallons || 0),
      vendor_activities: vendorActivities, till_reading_count: tills.length,
    };

    await admin.from('daily_close_reports').upsert(reportData, { onConflict: 'store_id,report_date' });

    return NextResponse.json({ success: true, tillId, report: reportData, shortOver: shortOverDay, tillCount: tills.length });
  } catch (err: any) {
    console.error('scan-till error:', err);
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
