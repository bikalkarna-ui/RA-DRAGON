import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function buildInvoicePdf(invoice: any, storeName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const red = rgb(0.86, 0.15, 0.15);
  const dark = rgb(0.1, 0.1, 0.12);
  const gray = rgb(0.45, 0.45, 0.48);
  const lightGray = rgb(0.93, 0.93, 0.94);

  let y = 740;

  // Header
  page.drawText(storeName, { x: 50, y, size: 20, font: bold, color: dark });
  page.drawText('INVOICE', { x: 450, y, size: 20, font: bold, color: red });
  y -= 20;
  page.drawText(invoice.invoice_number, { x: 450, y, size: 11, font, color: gray });
  y -= 40;

  // Bill to / dates
  page.drawText('BILL TO', { x: 50, y, size: 9, font: bold, color: gray });
  page.drawText('DATE', { x: 350, y, size: 9, font: bold, color: gray });
  page.drawText('DUE DATE', { x: 450, y, size: 9, font: bold, color: gray });
  y -= 16;
  page.drawText(invoice.customer_name, { x: 50, y, size: 12, font: bold, color: dark });
  page.drawText(new Date(invoice.created_at).toLocaleDateString('en-US'), { x: 350, y, size: 11, font, color: dark });
  page.drawText(invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US') : '—', { x: 450, y, size: 11, font, color: dark });
  y -= 16;
  if (invoice.customer_email) { page.drawText(invoice.customer_email, { x: 50, y, size: 10, font, color: gray }); y -= 14; }
  if (invoice.customer_address) { page.drawText(invoice.customer_address, { x: 50, y, size: 10, font, color: gray }); y -= 14; }

  y -= 20;

  // Table header
  page.drawRectangle({ x: 50, y: y - 8, width: 512, height: 26, color: lightGray });
  page.drawText('DESCRIPTION', { x: 58, y, size: 9, font: bold, color: gray });
  page.drawText('QTY', { x: 380, y, size: 9, font: bold, color: gray });
  page.drawText('PRICE', { x: 440, y, size: 9, font: bold, color: gray });
  page.drawText('TOTAL', { x: 500, y, size: 9, font: bold, color: gray });
  y -= 30;

  for (const item of (invoice.customer_invoice_items || [])) {
    if (y < 120) { y = 740; }
    page.drawText(String(item.description).slice(0, 50), { x: 58, y, size: 10, font, color: dark });
    page.drawText(String(item.quantity), { x: 380, y, size: 10, font, color: dark });
    page.drawText(`$${Number(item.unit_price).toFixed(2)}`, { x: 440, y, size: 10, font, color: dark });
    page.drawText(`$${Number(item.line_total).toFixed(2)}`, { x: 500, y, size: 10, font, color: dark });
    y -= 22;
  }

  y -= 15;
  page.drawLine({ start: { x: 350, y }, end: { x: 562, y }, thickness: 1, color: lightGray });
  y -= 20;

  page.drawText('Subtotal', { x: 400, y, size: 10, font, color: gray });
  page.drawText(`$${Number(invoice.subtotal).toFixed(2)}`, { x: 500, y, size: 10, font, color: dark });
  y -= 18;

  if (Number(invoice.tax_rate) > 0) {
    page.drawText(`Tax (${invoice.tax_rate}%)`, { x: 400, y, size: 10, font, color: gray });
    page.drawText(`$${Number(invoice.tax_amount).toFixed(2)}`, { x: 500, y, size: 10, font, color: dark });
    y -= 18;
  }

  page.drawText('TOTAL', { x: 400, y, size: 13, font: bold, color: red });
  page.drawText(`$${Number(invoice.total).toFixed(2)}`, { x: 495, y, size: 13, font: bold, color: red });

  if (invoice.notes) {
    y -= 50;
    page.drawText('NOTES', { x: 50, y, size: 9, font: bold, color: gray });
    y -= 16;
    page.drawText(String(invoice.notes).slice(0, 200), { x: 50, y, size: 10, font, color: gray });
  }

  return doc.save();
}
