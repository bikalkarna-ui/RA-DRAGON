import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function auth(sb: any, req: NextRequest) {
  const storeId = req.headers.get('X-Store-ID');
  const apiKey  = req.headers.get('X-API-Key');
  if (!storeId || !apiKey) return null;
  const { data } = await sb.from('stores').select('id,name,connector_api_key').eq('id', storeId).maybeSingle();
  if (!data || data.connector_api_key !== apiKey) return null;
  return data;
}

const n = (v: any) => { const x = Number(String(v ?? 0).replace(/[$,]/g,'')); return isNaN(x) ? 0 : Math.round(x*100)/100; };

export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const store = await auth(sb, req);
    if (!store) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const { event_type, data, timestamp } = await req.json();
    if (!event_type) return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });

    const today = new Date(timestamp || Date.now()).toISOString().split('T')[0];

    switch (event_type) {

      case 'sale': {
        await sb.from('till_readings').insert({ store_id: store.id, reading_date: today, source: 'connector', raw_data: data }).catch(() => {});
        // Also accumulate into daily report
        const { data: dr } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
        const payload = {
          store_id: store.id, report_date: today,
          gross_sales: n(dr?.gross_sales) + n(data?.total),
          cash_sales: n(dr?.cash_sales) + n(data?.cash),
          credit_sales: n(dr?.credit_sales) + n(data?.credit),
          debit_sales: n(dr?.debit_sales) + n(data?.debit),
          ebt_sales: n(dr?.ebt_sales) + n(data?.ebt),
          fuel_sales: n(dr?.fuel_sales) + n(data?.fuelSales),
          inside_sales: n(dr?.inside_sales) + n(data?.insideSales),
          taxes: n(dr?.taxes) + n(data?.tax),
          transactions: (dr?.transactions ?? 0) + 1,
          updated_at: new Date().toISOString(),
        };
        if (dr) await sb.from('daily_reports').update(payload).eq('id', dr.id);
        else await sb.from('daily_reports').insert(payload);
        break;
      }

      case 'sales_batch': {
        const sales = Array.isArray(data) ? data : [data];
        const { data: dr } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
        const totals = sales.reduce((acc: any, s: any) => ({
          gross: acc.gross + n(s.total), cash: acc.cash + n(s.cash),
          credit: acc.credit + n(s.credit), debit: acc.debit + n(s.debit),
          ebt: acc.ebt + n(s.ebt), fuel: acc.fuel + n(s.fuelSales),
          inside: acc.inside + n(s.insideSales), tax: acc.tax + n(s.tax),
        }), { gross:0, cash:0, credit:0, debit:0, ebt:0, fuel:0, inside:0, tax:0 });
        const payload = {
          store_id: store.id, report_date: today,
          gross_sales: n(dr?.gross_sales) + totals.gross,
          cash_sales: n(dr?.cash_sales) + totals.cash,
          credit_sales: n(dr?.credit_sales) + totals.credit,
          debit_sales: n(dr?.debit_sales) + totals.debit,
          ebt_sales: n(dr?.ebt_sales) + totals.ebt,
          fuel_sales: n(dr?.fuel_sales) + totals.fuel,
          inside_sales: n(dr?.inside_sales) + totals.inside,
          taxes: n(dr?.taxes) + totals.tax,
          transactions: (dr?.transactions ?? 0) + sales.length,
          updated_at: new Date().toISOString(),
        };
        if (dr) await sb.from('daily_reports').update(payload).eq('id', dr.id);
        else await sb.from('daily_reports').insert(payload);
        break;
      }

      case 'fuel_sale': {
        const { data: dr } = await sb.from('daily_reports').select('*').eq('store_id', store.id).eq('report_date', today).maybeSingle();
        const grade = (data?.grade || '').toLowerCase();
        const gallons = n(data?.gallons), total = n(data?.total);
        const upd: any = { store_id: store.id, report_date: today, fuel_sales: n(dr?.fuel_sales) + total, updated_at: new Date().toISOString() };
        if (grade.includes('diesel')) { upd.fuel_diesel_sales = n(dr?.fuel_diesel_sales) + total; upd.fuel_diesel_gallons = n(dr?.fuel_diesel_gallons) + gallons; }
        else if (grade.includes('premium') || grade.includes('plus')) { upd.fuel_premium_sales = n(dr?.fuel_premium_sales) + total; upd.fuel_premium_gallons = n(dr?.fuel_premium_gallons) + gallons; }
        else if (grade.includes('mid') || grade.includes('super')) { upd.fuel_midgrade_sales = n(dr?.fuel_midgrade_sales) + total; upd.fuel_midgrade_gallons = n(dr?.fuel_midgrade_gallons) + gallons; }
        else { upd.fuel_unleaded_sales = n(dr?.fuel_unleaded_sales) + total; upd.fuel_unleaded_gallons = n(dr?.fuel_unleaded_gallons) + gallons; }
        if (dr) await sb.from('daily_reports').update(upd).eq('id', dr.id);
        else await sb.from('daily_reports').insert(upd);
        break;
      }

      case 'daily_report': {
        const date = data?.date ? new Date(data.date).toISOString().split('T')[0] : today;
        const { data: dr } = await sb.from('daily_reports').select('id').eq('store_id', store.id).eq('report_date', date).maybeSingle();
        const payload = {
          store_id: store.id, report_date: date, status: 'in_progress',
          gross_sales: n(data?.grossSales), fuel_sales: n(data?.fuelSales),
          inside_sales: n(data?.insideSales), cash_sales: n(data?.cash),
          credit_sales: n(data?.credit), debit_sales: n(data?.debit),
          ebt_sales: n(data?.ebt), safe_drops: n(data?.safeDrops),
          paid_outs: n(data?.paidOuts), paid_ins: n(data?.paidIns),
          lottery_sales: n(data?.lotterySales), lottery_payouts: n(data?.lotteryPayouts),
          taxes: n(data?.taxes), drawer_difference: n(data?.shortOver),
          ai_notes: `Auto-synced from POS connector — Register ${data?.registerId || '1'}`,
          updated_at: new Date().toISOString(),
        };
        if (dr) await sb.from('daily_reports').update(payload).eq('id', dr.id);
        else await sb.from('daily_reports').insert(payload);
        break;
      }

      case 'inventory_update': {
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (!item?.name && !item?.upc) continue;
          // Find existing by barcode or name
          const { data: ex } = await sb.from('products').select('id,quantity,unit_cost')
            .eq('store_id', store.id)
            .eq('is_active', true)
            .or(item.upc ? `barcode.eq.${item.upc}` : `name.ilike.${item.name}`)
            .maybeSingle();

          const payload = {
            store_id: store.id, name: item.name || 'Unknown',
            barcode: item.upc || null, sku: item.sku || null,
            department: item.department || null, vendor_company: item.vendor || null,
            unit_cost: n(item.cost), unit_price: n(item.retailPrice),
            quantity: Math.round(n(item.quantity)), min_quantity: Math.round(n(item.minQuantity)) || 5,
            is_active: true,
          };
          if (ex) {
            await sb.from('products').update(payload).eq('id', ex.id);
            if (ex.quantity !== payload.quantity) {
              await sb.from('inventory_movements').insert({
                store_id: store.id, product_id: ex.id, product_name: payload.name,
                type: 'sync', quantity: payload.quantity - ex.quantity,
                quantity_before: ex.quantity, quantity_after: payload.quantity,
                reference_type: 'connector', reference_label: 'POS auto-sync',
              }).catch(() => {});
            }
          } else {
            await sb.from('products').insert(payload).catch(() => {});
          }
        }
        break;
      }

      case 'invoice': {
        await sb.from('invoices').insert({
          store_id: store.id, vendor_name: data?.vendorName || 'Unknown vendor',
          invoice_number: data?.invoiceNumber ? String(data.invoiceNumber) : null,
          total_amount: n(data?.total), status: 'NEEDS_REVIEW', source: 'connector',
        }).catch(() => {});
        break;
      }

      case 'clock_in': {
        await sb.from('time_clock').insert({
          store_id: store.id, employee_id: data?.employeeId || null,
          employee_name: data?.name || 'Unknown',
          clock_in: timestamp || new Date().toISOString(),
        }).catch(() => {});
        break;
      }

      case 'clock_out': {
        const { data: open } = await sb.from('time_clock').select('id,clock_in')
          .eq('store_id', store.id).eq('employee_name', data?.name || '')
          .is('clock_out', null).maybeSingle();
        if (open) {
          const out = timestamp || new Date().toISOString();
          const hrs = (new Date(out).getTime() - new Date(open.clock_in).getTime()) / 3600000;
          await sb.from('time_clock').update({ clock_out: out, hours_worked: Math.round(hrs * 100) / 100 }).eq('id', open.id);
        }
        break;
      }

      case 'safe_drop': {
        const { data: dr } = await sb.from('daily_reports').select('id,safe_drops').eq('store_id', store.id).eq('report_date', today).maybeSingle();
        const amount = n(data?.amount);
        if (dr) await sb.from('daily_reports').update({ safe_drops: n(dr.safe_drops) + amount }).eq('id', dr.id);
        else await sb.from('daily_reports').insert({ store_id: store.id, report_date: today, safe_drops: amount });
        // Log to timeline
        await sb.from('timeline_events').insert({ store_id: store.id, event_date: today, type: 'safe_drop', title: `Safe drop — ${fmt(amount)}`, amount }).catch(() => {});
        break;
      }

      default: break; // Unknown events silently accepted for forward-compat
    }

    return NextResponse.json({ success: true, received: event_type });
  } catch (err: any) {
    console.error('connector/sync:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function fmt(v: number) { return '$' + v.toFixed(2); }
