import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoiceDocument } from './InvoiceDocument'
import type { InvoiceRenderData } from './types'

export async function renderInvoicePDF(data: InvoiceRenderData): Promise<Buffer> {
  const el = React.createElement(InvoiceDocument, { data })
  // renderToBuffer's declared param type is ReactElement<DocumentProps> but
  // the renderer accepts any react-pdf tree rooted at <Document> — this cast
  // is safe because InvoiceDocument always renders one.
  return renderToBuffer(el as Parameters<typeof renderToBuffer>[0])
}
