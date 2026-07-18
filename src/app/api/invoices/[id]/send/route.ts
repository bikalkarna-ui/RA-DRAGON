import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInvoicePdf } from '@/lib/invoice-pdf';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: invoice, error } = await sb.from('customer_invoices')
    .select('*, customer_invoice_items(*), stores!inner(id, name, owner_id)')
    .eq('id', params.id).eq('stores.owner_id', user.id).single();

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  const store = (invoice as any).stores;
  if (!invoice.customer_email) {
    return NextResponse.json({ error: 'This invoice has no customer email on file. Add one, or download the PDF and send it manually.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'Email sending isn\'t set up yet. Download the PDF below and send it manually, or ask to have automated sending configured.',
      needsSetup: true,
    }, { status: 400 });
  }

  try {
    const pdfBytes = await buildInvoicePdf(invoice, store.name);
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${store.name} <invoices@ryxsorai.com>`,
        to: invoice.customer_email,
        subject: `Invoice ${invoice.invoice_number} from ${store.name}`,
        html: `<p>Hi ${invoice.customer_name},</p><p>Please find attached invoice <b>${invoice.invoice_number}</b> for <b>$${Number(invoice.total).toFixed(2)}</b>${invoice.due_date ? `, due ${new Date(invoice.due_date).toLocaleDateString('en-US')}` : ''}.</p><p>Thank you for your business.</p><p>${store.name}</p>`,
        attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBase64 }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Resend send failed:', errBody);
      return NextResponse.json({ error: 'Could not send email — please try again or download the PDF instead.' }, { status: 500 });
    }

    const { error: updateErr } = await sb.from('customer_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoice.id);
    if (updateErr) console.error('invoice status update failed (non-fatal):', updateErr);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('invoice send threw:', err);
    return NextResponse.json({ error: err?.message || 'Something went wrong sending the invoice.' }, { status: 500 });
  }
}
