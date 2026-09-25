import Link from 'next/link'
import { db } from '@eigensu/db'
import { payments } from '@eigensu/db/schema'
import { desc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { EmptyState } from '@/components/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatINR } from '@eigensu/core'

export const metadata = { title: 'Records — Payments' }

export default async function RecordsPaymentsPage() {
  await requireSession()

  const allPayments = await db.query.payments.findMany({
    with: {
      invoice: {
        columns: { id: true, invoiceNumber: true },
        with: {
          client: { columns: { id: true, name: true } },
        },
      },
    },
    orderBy: [desc(payments.dateReceived), desc(payments.createdAt)],
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-charcoal-600">
        {allPayments.length} payment{allPayments.length !== 1 ? 's' : ''}
      </p>

      {allPayments.length === 0 ? (
        <EmptyState heading="No payments recorded" />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-600">{p.dateReceived}</TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${p.invoice.id}`}
                      className="font-mono text-sm text-eigensu-blue hover:underline"
                    >
                      {p.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${p.invoice.client.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {p.invoice.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-700">
                    {formatINR(Number(p.amount))}
                  </TableCell>
                  <TableCell className="capitalize text-slate-600">{p.mode}</TableCell>
                  <TableCell className="text-slate-600">{p.reference ?? '—'}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-slate-500">
                    {p.notes ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
