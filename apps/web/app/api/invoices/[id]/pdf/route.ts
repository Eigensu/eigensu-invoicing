import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@eigensu/db'
import { invoices, settings } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: { client: true, lineItems: true, bankAccount: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Generate the PDF on-demand
  const [settingsRow] = await db.select().from(settings).limit(1)
  if (!settingsRow) {
    return NextResponse.json({ error: 'Settings not configured' }, { status: 500 })
  }

  const { renderInvoicePDF } = await import('@eigensu/invoice')
  const { buildInvoiceRenderData } = await import('@/lib/invoice-render-data')

  const renderData = buildInvoiceRenderData(invoice, settingsRow)
  const pdfBuf = await renderInvoicePDF(renderData)

  return new Response(new Uint8Array(pdfBuf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  })
}
