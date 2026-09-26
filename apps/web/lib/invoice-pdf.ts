import type { InvoiceRenderData } from '@eigensu/invoice'
import { getCanvaConnection } from '@/lib/canva/tokens'
import { buildCanvaAutofillData } from '@/lib/canva/render-data'
import { generateInvoicePdfViaCanva } from '@/lib/canva/autofill'

// Every invoice PDF goes through the connected Canva Brand Template first,
// so nobody ever has to open Canva by hand to make an invoice look right.
// Falls back to the built-in @eigensu/invoice renderer — never fatal — when
// Canva isn't connected yet, or a single request to it fails (more than 6
// line items, an expired/revoked connection, a transient API error, etc.).
export async function generateInvoicePDF(
  data: InvoiceRenderData,
  invoiceTitle: string,
): Promise<Buffer> {
  const connection = await getCanvaConnection()
  if (connection) {
    try {
      const canvaData = buildCanvaAutofillData(data)
      return await generateInvoicePdfViaCanva(connection.brandTemplateId, invoiceTitle, canvaData)
    } catch (err) {
      console.error('Canva invoice PDF generation failed, falling back to built-in renderer:', err)
    }
  }

  const { renderInvoicePDF } = await import('@eigensu/invoice')
  return renderInvoicePDF(data)
}
