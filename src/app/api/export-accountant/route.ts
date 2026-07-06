import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: store } = await sb.from('stores').select('id,name').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!store) return NextResponse.json({ error: 'No store' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const end   = searchParams.get('end')   || new Date().toISOString().split('T')[0];
    const format = searchParams.get('format') || 'csv';

    const { data: reports } = await sb.from('daily_reports').select('*').eq('store_id', store.id).gte('report_date', start).lte('report_date', end).order('report_date');
    const { data: invoices } = await sb.from('invoices').select('*').eq('store_id', store.id).gte('created_at', start+'T00:00:00').lte('created_at', end+'T23:59:59').order('created_at');

    const n = (v: any) => Number(v || 0);

    if (format === 'csv') {
      const rows: string[][] = [
        // Header
        ['RA Dragon Export', store.name, `${start} to ${end}`, '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', '', ''],
        // Daily reports
        ['=== DAILY SALES REPORTS ===', '', '', '', '', '', '', '', '', ''],
        ['Date','Gross Sales','Fuel Sales','Inside Sales','Cash','Credit','Debit','Checks','Taxes','Short/Over'],
        ...(reports||[]).map(r => [
          r.report_date, n(r.gross_sales), n(r.fuel_sales), n(r.inside_sales),
          n(r.cash_sales), n(r.credit_sales), n(r.debit_sales), n(r.check_sales),
          n(r.taxes), n(r.drawer_difference)
        ]),
        // Totals
        ['TOTAL',
          (reports||[]).reduce((s,r)=>s+n(r.gross_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.fuel_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.inside_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.cash_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.credit_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.debit_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.check_sales),0),
          (reports||[]).reduce((s,r)=>s+n(r.taxes),0),
          (reports||[]).reduce((s,r)=>s+n(r.drawer_difference),0),
        ],
        ['', '', '', '', '', '', '', '', '', ''],
        // Invoices
        ['=== VENDOR INVOICES ===', '', '', '', '', '', '', '', '', ''],
        ['Date','Vendor','Invoice #','Amount','Status','','','','',''],
        ...(invoices||[]).map(i => [
          new Date(i.created_at).toISOString().split('T')[0],
          i.vendor_name||'', i.invoice_number||'', n(i.total_amount), i.status||'',
          '','','','',''
        ]),
      ];

      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ra-dragon-export-${start}-${end}.csv"`,
        },
      });
    }

    return NextResponse.json({ reports, invoices });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
