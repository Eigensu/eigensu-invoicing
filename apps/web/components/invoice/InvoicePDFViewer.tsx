'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { InvoiceDocument } from '@eigensu/invoice'
import type { InvoiceRenderData } from '@eigensu/invoice'

interface Props {
  data: InvoiceRenderData
}

export default function InvoicePDFViewer({ data }: Props) {
  return (
    <PDFViewer style={{ width: '100%', height: '700px', border: 'none' }}>
      <InvoiceDocument data={data} />
    </PDFViewer>
  )
}
