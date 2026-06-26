import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-haiku-4-5';

async function callAI(images: { b64: string; type: string }[], apiKey: string): Promise<any> {
  const content: any[] = [
    {
      type: 'text',
      text: `You are extracting numbers from a convenience store close-till or daily sales report. Return ONLY this JSON with real numbers you see (use 0 if not visible):
{"cash_counted":0,"checks_counted":0,"atm_total":0,"cash_sales":0,"credit_sales":0,"debit_sales":0,"ebt_sales":0,"check_sales":0,"mobile_sales":0,"mac_payout":0,"lotto_paid":0,"lottery_paid":0,"purchase_paid":0,"dept_tax":0,"dept_nontax":0,"dept_cig":0,"dept_beer_wine":0,"dept_novelty":0,"dept_vape":0,"dept_unknown_upc":0,"lotto_sales":0,"lottery_sales":0,"money_order_sales":0,"money_order_fee":0,"fuel_unleaded_gallons":0,"fuel_midgrade_gallons":0,"fuel_premium_gallons":0,"fuel_diesel_gallons":0,"fuel_unleaded_sales":0,"fuel_midgrade_sales":0,"fuel_premium_sales":0,"fuel_diesel_sales":0,"store_deposit":0,"atg_unleaded":0,"atg_midgrade":0,"atg_premium":0,"atg_diesel":0,"vendor_activities":[],"notes":""}`
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
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ra-solution.app',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content }],
    }),
  });

  const raw = await res.text();

  if (!res.ok) {
    let errMsg = `OpenRouter error ${res.status}`;
    try { const j = JSON.parse(raw); errMsg = j?.error?.message || j?.message || errMsg; } catch {}
    throw new Error(errMsg);
  }

  let data: any;
  try { data = JSON.parse(raw); } catch { throw new Error('OpenRouter returned invalid response'); }

  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('AI returned empty response');

  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(clean); }
  catch { throw new Error(`AI response not valid JSON: ${clean.slice(0, 100)}`); }
}

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not logged in — please sign in first' }, { status: 401 });

    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store found — please complete setup' }, { status: 400 });

    const formData = await request.formData();
    const employeeName = (formData.get('employee_name') as string) || 'Unknown';
    const employeeId   = (formData.get('employee_id')   as string) || null;
    const manualStr    = formData.get('manual_data') as string | null;

    const admin  = createAdminClient();
    const apiKey = process.env.OPENROUTER_API_KEY;

    let parsed: any = {};

    if (manualStr) {
      try { parsed = JSON.parse(manualStr); } catch { parsed = {}; }
    } else {
      if (!apiKey) return NextResponse.json({ error: 'OPENROUTER_API_KEY is not set in your Vercel environment variables' }, { status: 500 });

      // Collect all uploaded files (multi-page)
      const files: File[] = [];
      const rawFiles = formData.getAll('file') as File[];
      files.push(...rawFiles.filter(f => f.size > 0));
      for (let i = 1; i <= 10; i++) {
        const f = formData.get(`file${i}`) as File | null;
        if (f && f.size > 0) files.push(f);
      }

      if (files.length === 0) return NextResponse.json({ error: 'No file received — please try again' }, { status: 400 });

      const images: { b64: string; type: string }[] = [];
      for (const file of files) {
        const buf = Buffer.from(await file.arrayBuffer());
        images.push({ b64: buf.toString('base64'), type: file.type || 'image/jpeg' });
        // Save file — non-blocking, ignore if bucket missing
        try { await admin.storage.from('till_readings').upload(`${store.id}/${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`, buf, { contentType: file.type }); } catch {}
      }

      parsed = await callAI(images, apiKey);
    }

    const n = (v: any) => Math.round((parseFloat(v) || 0) * 100) / 100;

    const totalPayouts = n(parsed.mac_payout) + n(parsed.lotto_paid) + n(parsed.lottery_paid) + n(parsed.purchase_paid);
    const cashExpected = n(parsed.cash_sales) - totalPayouts;
    const cashActual   = n(parsed.cash_counted);

    const tillData = {
      store_id: store.id, employee_name: employeeName, employee_id: employeeId,
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
      raw_ai_response: parsed, notes: parsed.notes || null,
    };

    const { data: till, error: tillErr } = await admin.from('till_readings').insert(tillData).select('id').single();
    if (tillErr) return NextResponse.json({ error: `Database error: ${tillErr.message} — have you run schema.sql in Supabase?` }, { status: 500 });

    // Aggregate all today's till readings → daily close report
    const today = new Date().toISOString().split('T')[0];
    const { data: allTills } = await admin.from('till_readings').select('*').eq('store_id', store.id).eq('reading_date', today);
    const tills = allTills ?? [];
    const sum = (f: string) => tills.reduce((s: number, t: any) => s + Number(t[f] || 0), 0);

    const totalCash = sum('cash_sales'), totalCredit = sum('credit_sales'), totalDebit = sum('debit_sales'), totalEbt = sum('ebt_sales'), totalCheck = sum('check_sales');
    const allMac = sum('mac_payout'), allLotto = sum('lotto_paid'), allLottery = sum('lottery_paid'), allPurch = sum('purchase_paid');
    const allPayouts = allMac + allLotto + allLottery + allPurch;
    const totalIn = totalCash + totalCredit + totalDebit + totalEbt + totalCheck;
    const cashExpDay = totalCash - allPayouts;
    const cashActDay = sum('cash_counted');
    const shortOverDay = cashActDay - cashExpDay;
    const totalSales = sum('dept_tax') + sum('dept_nontax') + sum('dept_cig') + sum('dept_beer_wine') + sum('dept_novelty') + sum('dept_vape') + sum('dept_unknown_upc') + sum('fuel_unleaded_sales') + sum('fuel_midgrade_sales') + sum('fuel_premium_sales') + sum('fuel_diesel_sales') + sum('lotto_sales') + sum('lottery_sales') + sum('money_order_sales') + sum('money_order_fee');
    const last = tills[tills.length - 1] ?? {};
    const vendorActs = tills.flatMap((t: any) => Array.isArray(t.raw_ai_response?.vendor_activities) ? t.raw_ai_response.vendor_activities : []);

    const reportData = {
      store_id: store.id, report_date: today,
      atm_total: sum('atm_total'), checks_total: sum('checks_counted'),
      cash_in_drawer: cashActDay, net_cash: cashActDay - sum('atm_total'),
      total_cash_flow: totalIn,
      cash_expected: cashExpDay, cash_actual: cashActDay, short_over: shortOverDay,
      dept_tax: sum('dept_tax'), dept_nontax: sum('dept_nontax'), dept_cig: sum('dept_cig'),
      dept_beer_wine: sum('dept_beer_wine'), dept_novelty: sum('dept_novelty'),
      dept_vape: sum('dept_vape'), dept_unknown_upc: sum('dept_unknown_upc'),
      total_sales: totalSales, lotto_sales: sum('lotto_sales'), lottery_sales: sum('lottery_sales'),
      fuel_unleaded: sum('fuel_unleaded_sales'), fuel_midgrade: sum('fuel_midgrade_sales'),
      fuel_premium: sum('fuel_premium_sales'), fuel_diesel: sum('fuel_diesel_sales'),
      money_order_sales: sum('money_order_sales'), money_order_fee: sum('money_order_fee'),
      sales_tax_collected: sum('dept_tax'),
      credit_card_total: totalCredit, ebt_total: totalEbt, check_total: totalCheck, coupon_total: 0,
      mac_payout: allMac, purchase_paid: allPurch, lotto_paid: allLotto, lottery_paid: allLottery,
      total_in: totalIn, total_out: allPayouts, gross: totalSales, net: totalSales - allPayouts,
      day_close_total_in: totalIn, day_close_total_out: allPayouts,
      mac_in: sum('atm_total'), mac_out: allMac,
      store_deposit: cashActDay, mac_deposit: 0, total_deposit: cashActDay,
      atg_unleaded: Number(last.fuel_unleaded_gallons || 0), atg_midgrade: Number(last.fuel_midgrade_gallons || 0),
      atg_premium: Number(last.fuel_premium_gallons || 0), atg_diesel: Number(last.fuel_diesel_gallons || 0),
      vendor_activities: vendorActs, till_reading_count: tills.length,
    };

    await admin.from('daily_close_reports').upsert(reportData, { onConflict: 'store_id,report_date' });

    // Auto-generate stock notifications
    try {
      const { data: prods } = await admin.from('products').select('id,name,quantity,min_quantity,max_quantity,vendor_company').eq('store_id', store.id).eq('is_active', true);
      for (const p of prods ?? []) {
        if (p.quantity <= p.min_quantity) {
          const type = p.quantity === 0 ? 'out_of_stock' : 'low_stock';
          await admin.from('notifications').upsert({
            store_id: store.id, type,
            title: p.quantity === 0 ? `${p.name} is OUT OF STOCK` : `${p.name} is running low`,
            message: p.quantity === 0 ? `Order from ${p.vendor_company ?? 'vendor'} immediately` : `Only ${p.quantity} units left (min: ${p.min_quantity})`,
            product_id: p.id,
            data: { quantity: p.quantity, min_quantity: p.min_quantity, vendor: p.vendor_company },
            is_read: false,
          }, { onConflict: 'store_id,type,product_id', ignoreDuplicates: false });
        }
      }
    } catch { /* notifications table may not exist yet */ }

    return NextResponse.json({ success: true, tillId: till?.id, report: reportData, shortOver: shortOverDay, tillCount: tills.length });

  } catch (err: any) {
    console.error('scan-till error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
