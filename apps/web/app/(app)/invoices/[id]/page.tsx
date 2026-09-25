import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@eigensu/db'
import { invoices, settings } from '@eigensu/db/schema'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InvoicePreview } from '@/components/invoice/InvoicePreview'
import { InvoiceActions } from '@/components/invoices/invoice-actions'
import { RecordPaymentDialog } from '@/components/invoices/record-payment-dialog'
import { buildInvoiceRenderData } from '@/lib/invoice-render-data'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { formatDate } from '@/lib/format-date'
import { formatINR, computeInvoiceOutstanding } from '@eigensu/core'
import { ArrowLeft, Download } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    columns: { invoiceNumber: true },
  })
  return { title: inv ? `Invoice ${inv.invoiceNumber}` : 'Invoice' }
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireSession()
  const canWrite = hasPermission(session, 'invoices:write')
  const canPayment = hasPermission(session, 'payments:write')

  const [invoice, settingsRow] = await Promise.all([
    db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        client: true,
        project: { columns: { id: true, name: true } },
        bankAccount: true,
        lineItems: true,
        payments: true,
        scheduleItemLinks: {
          with: {
            scheduleItem: { columns: { id: true, label: true, status: true } },
          },
        },
      },
    }),
    db
      .select()
      .from(settings)
      .limit(1)
      .then((r) => r[0] ?? null),
  ])

  if (!invoice) notFound()
  if (!settingsRow) notFound()

  const renderData = buildInvoiceRenderData(invoice, settingsRow)
  const outstanding = computeInvoiceOutstanding(
    Number(invoice.total),
    invoice.payments.map((p) => ({ amount: Number(p.amount) })),
  )

  const canSend = canWrite && invoice.status !== 'cancelled'
  const canCancel = canWrite && invoice.status === 'draft'
  const canRecordPayment =
    canPayment && invoice.status !== 'cancelled' && invoice.status !== 'paid'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/records/invoices"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Invoices
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-slate-900">
            {invoice.invoiceNumber}
          </h1>
          <div className="flex items-center gap-2">
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.project && (
              <Badge variant="outline">
                <Link href={`/projects/${invoice.project.id}`} className="hover:underline">
                  {invoice.project.name}
                </Link>
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4" />
              PDF
            </a>
          </Button>
          {(canSend || canCancel) && (
            <InvoiceActions invoiceId={id} canSend={canSend} canCancel={canCancel} />
          )}
          {canRecordPayment && (
            <RecordPaymentDialog invoiceId={id} outstanding={outstanding} />
          )}
        </div>
      </div>

      {/* Invoice meta */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Client</dt>
            <dd className="mt-1">
              <Link
                href={`/clients/${invoice.client.id}`}
                className="text-eigensu-blue hover:underline"
              >
                {invoice.client.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Issue Date</dt>
            <dd className="mt-1 text-slate-900">{invoice.issueDate}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Due Date</dt>
            <dd className="mt-1 text-slate-900">{invoice.dueDate}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Total</dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {formatINR(Number(invoice.total))}
            </dd>
          </div>
          {outstanding > 0 && outstanding < Number(invoice.total) && (
            <div>
              <dt className="font-medium text-slate-500">Outstanding</dt>
              <dd className="mt-1 font-semibold text-amber-700">{formatINR(outstanding)}</dd>
            </div>
          )}
          {invoice.sentAt && (
            <div>
              <dt className="font-medium text-slate-500">Sent At</dt>
              <dd className="mt-1 text-slate-900">
                {formatDate(invoice.sentAt)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Line items */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-6 py-3 font-medium text-slate-500">Description</th>
              <th className="px-6 py-3 text-right font-medium text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((li) => (
                <tr key={li.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-slate-900">{li.description}</td>
                  <td className="px-6 py-3 text-right font-medium text-slate-900">
                    {formatINR(Number(li.amount))}
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot className="bg-slate-50 text-sm">
            <tr>
              <td className="px-6 py-2 text-slate-500">Subtotal</td>
              <td className="px-6 py-2 text-right text-slate-900">
                {formatINR(Number(invoice.subtotal))}
              </td>
            </tr>
            <tr>
              <td className="px-6 py-2 text-slate-500">{renderData.taxLabel}</td>
              <td className="px-6 py-2 text-right text-slate-900">
                {formatINR(Number(invoice.tax))}
              </td>
            </tr>
            <tr className="border-t border-slate-200">
              <td className="px-6 py-3 font-semibold text-slate-900">Total</td>
              <td className="px-6 py-3 text-right font-semibold text-slate-900">
                {formatINR(Number(invoice.total))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Payment history */}
      {invoice.payments.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                <th className="px-6 py-3 font-medium text-slate-500">Mode</th>
                <th className="px-6 py-3 font-medium text-slate-500">Reference</th>
                <th className="px-6 py-3 text-right font-medium text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-slate-900">{p.dateReceived}</td>
                  <td className="px-6 py-3 capitalize text-slate-600">{p.mode}</td>
                  <td className="px-6 py-3 text-slate-600">{p.reference ?? '—'}</td>
                  <td className="px-6 py-3 text-right font-medium text-emerald-700">
                    {formatINR(Number(p.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF preview */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">PDF Preview</h2>
        <InvoicePreview data={renderData} />
      </div>
    </div>
  )
}
