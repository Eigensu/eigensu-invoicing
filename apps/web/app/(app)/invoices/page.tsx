import Link from 'next/link'
import { db } from '@eigensu/db'
import { invoices } from '@eigensu/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus } from 'lucide-react'
import { formatINR } from '@eigensu/core'

export const metadata = { title: 'Invoices' }

const STATUS_VARIANT: Record<
  string,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  draft: 'secondary',
  sent: 'default',
  partial: 'warning',
  paid: 'success',
  overdue: 'destructive',
  cancelled: 'secondary',
}

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']

type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await requireSession()
  const canWrite = hasPermission(session, 'invoices:write')
  const { status } = await searchParams

  const validStatus = STATUS_OPTIONS.slice(1).includes(status ?? '')
    ? (status as InvoiceStatus)
    : undefined

  const invoiceList = await db.query.invoices.findMany({
    where: validStatus ? eq(invoices.status, validStatus) : undefined,
    with: {
      client: { columns: { id: true, name: true } },
    },
    orderBy: [desc(invoices.createdAt)],
  })

  const activeFilter = status && STATUS_OPTIONS.includes(status) ? status : 'all'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">
            {invoiceList.length} invoice{invoiceList.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Status:</span>
        <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 p-1">
          {STATUS_OPTIONS.map((s) => (
            <a
              key={s}
              href={s === 'all' ? '/invoices' : `/invoices?status=${s}`}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                activeFilter === s
                  ? 'bg-white shadow-sm text-eigensu-blue'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s}
            </a>
          ))}
        </div>
      </div>

      {invoiceList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-500">No invoices yet</p>
          {canWrite && (
            <Button asChild size="sm" className="mt-4">
              <Link href="/invoices/new">Create invoice</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceList.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono text-sm text-eigensu-blue hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${inv.client.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {inv.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-slate-600">{inv.issueDate}</TableCell>
                  <TableCell className="text-slate-600">{inv.dueDate}</TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatINR(Number(inv.total))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'}>
                      {inv.status}
                    </Badge>
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
