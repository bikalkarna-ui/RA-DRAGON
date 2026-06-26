import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const MODEL = 'anthropic/claude-sonnet-4.6';

export async function POST(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const employeeName = formData.get('employee_name') as string || 'Unknown';
    const employeeId = formData.get('employee_id') as string || null;
    const manualData = formData.get('manual_data') as string | null;

    const admin = createAdminClient();
    const apiKey = process.env.OPENROUTER_API_KEY;

    let parsed: any = {};

    if (file && file.size > 0) {
      const ext = file.name.split('.').pop() || 'pdf';
      const filePath = `${store.id}/${crypto.randomUUID()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      await admin.storage.from('till_readings').upload(filePath, buf, { contentType: file.type });

      if (apiKey) {
        const b64 = buf.toString('base64');
        const dataUrl = `data:${file.type};base64,${b64}`;
        const isPdf = file.type === 'application/pdf';

        const prompt = `This is a convenience store close-till or daily sales report. Extract ALL numbers you can see and return ONLY valid JSON (no markdown, no explanation):
{
  "cash_counted": number,
  "checks_counted": number,
  "cash_sales": number,
  "credit_sales": number,
  "debit_sales": number,
  "ebt_sales": number,
  "check_sales": number,
  "mobile_sales": number,
  "atm_total": number,
  "mac_payout": number,
  "lotto_paid": number,
  "lottery_paid": number,
  "purchase_paid": number,
  "dept_tax": number,
  "dept_nontax": number,
  "dept_cig": number,
  "dept_beer_wine": number,
  "dept_novelty": number,
  "dept_vape": number,
  "dept_unknown_upc": number,
  "fuel_unleaded_gallons": number,
  "fuel_midgrade_gallons": number,
  "fuel_premium_gallons": number,
  "fuel_diesel_gallons": number,
  "fuel_unleaded_sales": number,
  "fuel_midgrade_sales": number,
  "fuel_premium_sales": number,
  "fuel_diesel_sales": number,
  "lotto_sales": number,
  "lottery_sales": number,
  "money_order_sales": number,
  "money_order_fee": number,
  "store_deposit": number,
  "vendor_activities": [{"vendor": "name", "retail": number, "cost": number, "mop": "Cash/Credit"}],
  "atg_unleaded": number,
  "atg_midgrade": number,
  "atg_premium": number,
  "atg_diesel": number,
  "notes": "any other relevant info"
}
Use 0 for any field not visible. Extract every number you can see.`;

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: [
              { type: 'text', text: prompt },
              isPdf
                ? { type: 'file', file: { filename: 'report.pdf', file_data: dataUrl } }
                : { type: 'image_url', image_url: { url: dataUrl } },
            ] }],
          }),
        });

        if (res.ok) {
          const orData = await res.json();
          const content = orData?.choices?.[0]?.message?.content ?? '';
          try { parsed = JSON.parse(content.replace(/^```json\s*|```\s*$/g, '').trim()); }
          catch { parsed = {}; }
        }
      }
    } else if (manualData) {
      try { parsed = JSON.parse(manualData); } catch { parsed = {}; }
    }

    const n = (v: any) => Math.round((parseFloat(v) || 0) * 100) / 100;

    // Calculate total sales
    const totalSales =
      n(parsed.dept_tax) + n(parsed.dept_nontax) + n(parsed.dept_cig) +
      n(parsed.dept_beer_wine) + n(parsed.dept_novelty) + n(parsed.dept_vape) +
      n(parsed.dept_unknown_upc) +
      n(parsed.fuel_unleaded_sales) + n(parsed.fuel_midgrade_sales) +
      n(parsed.fuel_premium_sales) + n(parsed.fuel_diesel_sales) +
      n(parsed.lotto_sales) + n(parsed.lottery_sales) +
      n(parsed.money_order_sales) + n(parsed.money_order_fee);

    // Cash expected = cash_sales - payouts
    const totalPayouts = n(parsed.mac_payout) + n(parsed.lotto_paid) + n(parsed.lottery_paid) + n(parsed.purchase_paid);
    const cashExpected = n(parsed.cash_sales) - totalPayouts;
    const cashActual = n(parsed.cash_counted);
    const shortOver = cashActual - cashExpected;

    // Save till reading
    const tillData = {
      store_id: store.id,
      employee_name: employeeName,
      employee_id: employeeId || null,
      reading_date: new Date().toISOString().split('T')[0],
      cash_counted: n(parsed.cash_counted),
      checks_counted: n(parsed.checks_counted),
      cash_sales: n(parsed.cash_sales),
      credit_sales: n(parsed.credit_sales),
      debit_sales: n(parsed.debit_sales),
      ebt_sales: n(parsed.ebt_sales),
      check_sales: n(parsed.check_sales),
      mobile_sales: n(parsed.mobile_sales),
      atm_total: n(parsed.atm_total),
      mac_payout: n(parsed.mac_payout),
      lotto_paid: n(parsed.lotto_paid),
      lottery_paid: n(parsed.lottery_paid),
      purchase_paid: n(parsed.purchase_paid),
      dept_tax: n(parsed.dept_tax),
      dept_nontax: n(parsed.dept_nontax),
      dept_cig: n(parsed.dept_cig),
      dept_beer_wine: n(parsed.dept_beer_wine),
      dept_novelty: n(parsed.dept_novelty),
      dept_vape: n(parsed.dept_vape),
      dept_unknown_upc: n(parsed.dept_unknown_upc),
      fuel_unleaded_gallons: n(parsed.fuel_unleaded_gallons),
      fuel_midgrade_gallons: n(parsed.fuel_midgrade_gallons),
      fuel_premium_gallons: n(parsed.fuel_premium_gallons),
      fuel_diesel_gallons: n(parsed.fuel_diesel_gallons),
      fuel_unleaded_sales: n(parsed.fuel_unleaded_sales),
      fuel_midgrade_sales: n(parsed.fuel_midgrade_sales),
      fuel_premium_sales: n(parsed.fuel_premium_sales),
      fuel_diesel_sales: n(parsed.fuel_diesel_sales),
      lotto_sales: n(parsed.lotto_sales),
      lottery_sales: n(parsed.lottery_sales),
      money_order_sales: n(parsed.money_order_sales),
      money_order_fee: n(parsed.money_order_fee),
      raw_ai_response: Object.keys(parsed).length > 0 ? parsed : null,
      notes: parsed.notes || null,
    };

    const { data: till } = await admin.from('till_readings').insert(tillData).select('id').single();

    // Regenerate daily close report
    const today = new Date().toISOString().split('T')[0];
    const { data: allTills } = await admin.from('till_readings')
      .select('*').eq('store_id', store.id).eq('reading_date', today);

    const tills = allTills ?? [];
    const sum = (field: string) => tills.reduce((s: number, t: any) => s + Number(t[field] || 0), 0);

    const totalCashSales = sum('cash_sales');
    const totalCreditSales = sum('credit_sales');
    const totalDebitSales = sum('debit_sales');
    const totalEbtSales = sum('ebt_sales');
    const totalCheckSales = sum('check_sales');
    const totalMacPayout = sum('mac_payout');
    const totalLottoPaid = sum('lotto_paid');
    const totalLotteryPaid = sum('lottery_paid');
    const totalPurchasePaid = sum('purchase_paid');
    const totalPayoutsDay = totalMacPayout + totalLottoPaid + totalLotteryPaid + totalPurchasePaid;

    const totalSalesDay =
      sum('dept_tax') + sum('dept_nontax') + sum('dept_cig') + sum('dept_beer_wine') +
      sum('dept_novelty') + sum('dept_vape') + sum('dept_unknown_upc') +
      sum('fuel_unleaded_sales') + sum('fuel_midgrade_sales') + sum('fuel_premium_sales') + sum('fuel_diesel_sales') +
      sum('lotto_sales') + sum('lottery_sales') + sum('money_order_sales') + sum('money_order_fee');

    const cashExpectedDay = totalCashSales - totalPayoutsDay;
    const cashActualDay = sum('cash_counted');
    const shortOverDay = cashActualDay - cashExpectedDay;
    const totalDebit = totalCashSales + totalCreditSales + totalDebitSales + totalEbtSales + totalCheckSales;

    const vendorActivities = tills.flatMap((t: any) =>
      Array.isArray(t.raw_ai_response?.vendor_activities) ? t.raw_ai_response.vendor_activities : []
    );

    const reportData = {
      store_id: store.id,
      report_date: today,
      atm_total: sum('atm_total'),
      checks_total: sum('checks_counted'),
      cash_in_drawer: cashActualDay,
      net_cash: cashActualDay - sum('atm_total'),
      total_cash_flow: totalDebit,
      cash_expected: cashExpectedDay,
      cash_actual: cashActualDay,
      short_over: shortOverDay,
      dept_tax: sum('dept_tax'),
      dept_nontax: sum('dept_nontax'),
      dept_cig: sum('dept_cig'),
      dept_beer_wine: sum('dept_beer_wine'),
      dept_novelty: sum('dept_novelty'),
      dept_vape: sum('dept_vape'),
      dept_unknown_upc: sum('dept_unknown_upc'),
      total_sales: totalSalesDay,
      lotto_sales: sum('lotto_sales'),
      lottery_sales: sum('lottery_sales'),
      fuel_unleaded: sum('fuel_unleaded_sales'),
      fuel_midgrade: sum('fuel_midgrade_sales'),
      fuel_premium: sum('fuel_premium_sales'),
      fuel_diesel: sum('fuel_diesel_sales'),
      money_order_sales: sum('money_order_sales'),
      money_order_fee: sum('money_order_fee'),
      sales_tax_collected: sum('dept_tax') * 0.0825,
      credit_card_total: totalCreditSales,
      ebt_total: totalEbtSales,
      check_total: totalCheckSales,
      coupon_total: 0,
      mac_payout: totalMacPayout,
      purchase_paid: totalPurchasePaid,
      lotto_paid: totalLottoPaid,
      lottery_paid: totalLotteryPaid,
      total_in: totalDebit,
      total_out: totalPayoutsDay,
      gross: totalSalesDay,
      net: totalSalesDay - totalPayoutsDay,
      day_close_total_in: totalDebit,
      day_close_total_out: totalPayoutsDay,
      mac_in: sum('atm_total'),
      mac_out: totalMacPayout,
      store_deposit: cashActualDay,
      mac_deposit: 0,
      total_deposit: cashActualDay,
      atg_unleaded: tills[tills.length - 1]?.fuel_unleaded_gallons || 0,
      atg_midgrade: tills[tills.length - 1]?.fuel_midgrade_gallons || 0,
      atg_premium: tills[tills.length - 1]?.fuel_premium_gallons || 0,
      atg_diesel: tills[tills.length - 1]?.fuel_diesel_gallons || 0,
      vendor_activities: vendorActivities,
      till_reading_count: tills.length,
    };

    await admin.from('daily_close_reports').upsert(reportData, { onConflict: 'store_id,report_date' });

    // Generate smart notifications for low/out stock
    const { data: lowProds } = await admin.from('products')
      .select('id,name,quantity,min_quantity,max_quantity,vendor_company')
      .eq('store_id', store.id).eq('is_active', true)
      .or(`quantity.eq.0,quantity.lte.min_quantity`);

    for (const prod of lowProds ?? []) {
      const isOut = prod.quantity === 0;
      await admin.from('notifications').upsert({
        store_id: store.id,
        type: isOut ? 'out_of_stock' : 'low_stock',
        title: isOut ? `${prod.name} is OUT OF STOCK` : `${prod.name} is running low`,
        message: isOut
          ? `${prod.name} has 0 units. Order from ${prod.vendor_company ?? 'vendor'} immediately.`
          : `${prod.name} has only ${prod.quantity} units left (min: ${prod.min_quantity}). Time to reorder.`,
        product_id: prod.id,
        data: { quantity: prod.quantity, min_quantity: prod.min_quantity, vendor: prod.vendor_company },
        is_read: false,
      }, { onConflict: 'store_id,type,product_id', ignoreDuplicates: true });
    }

    return NextResponse.json({
      success: true,
      tillId: till?.id,
      report: reportData,
      shortOver: shortOverDay,
      cashExpected: cashExpectedDay,
      cashActual: cashActualDay,
      tillCount: tills.length,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
