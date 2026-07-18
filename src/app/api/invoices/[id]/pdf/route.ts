import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Fetch the invoice first, then verify it belongs to one of this user's
  // stores (an account can own several) — rather than guessing one store
  // up front and failing if the invoice happens to be under a different one.
  const { data: invoice, error } = await sb.from('customer_invoices')
    .select('*, customer_invoice_items(*), stores!inner(id, name, owner_id)')
    .eq('id', params.id).eq('stores.owner_id', user.id).single();

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const pdfBytes = await buildInvoicePdf(invoice, (invoice as any).stores.name);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
