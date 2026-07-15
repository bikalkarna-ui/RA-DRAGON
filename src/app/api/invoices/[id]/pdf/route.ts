import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: store } = await sb.from('stores').select('id, name').eq('owner_id', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 });

  const { data: invoice, error } = await sb.from('customer_invoices')
    .select('*, customer_invoice_items(*)')
    .eq('id', params.id).eq('store_id', store.id).single();

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const pdfBytes = await buildInvoicePdf(invoice, store.name);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
