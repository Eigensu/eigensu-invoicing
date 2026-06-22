'use client'

import dynamic from 'next/dynamic'
import type { InvoiceRenderData } from '@eigensu/invoice'

// PDFViewer uses window/document — must never run during SSR
const InvoicePDFViewer = dynamic(() => import('./InvoicePDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[700px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
      <p className="text-sm text-slate-500">Loading PDF preview…</p>
    </div>
  ),
})

interface Props {
  data: InvoiceRenderData
}

export function InvoicePreview({ data }: Props) {
  return <InvoicePDFViewer data={data} />
}
