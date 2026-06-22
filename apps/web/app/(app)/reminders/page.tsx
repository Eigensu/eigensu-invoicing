import Link from 'next/link'
import { db } from '@eigensu/db'
import { reminders } from '@eigensu/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/empty-state'

export const metadata = { title: 'Reminders' }

const STATUS_OPTIONS = ['all', 'pending', 'sent', 'failed', 'skipped'] as const

type ReminderStatus = 'pending' | 'sent' | 'failed' | 'skipped'

const STATUS_VARIANT: Record<
  ReminderStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  pending: 'warning',
  sent: 'success',
  failed: 'destructive',
  skipped: 'secondary',
}

const TYPE_LABEL: Record<string, string> = {
  client_due_soon: 'Due soon',
  client_due: 'Due today',
  client_overdue: 'Overdue',
  internal_alert: 'Internal alert',
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireSession()
  const { status } = await searchParams

  const validStatus = (STATUS_OPTIONS.slice(1) as string[]).includes(status ?? '')
    ? (status as ReminderStatus)
    : undefined

  const allReminders = await db.query.reminders.findMany({
    where: validStatus ? eq(reminders.status, validStatus) : undefined,
    with: {
      invoice: {
        columns: { id: true, invoiceNumber: true },
        with: { client: { columns: { id: true, name: true } } },
      },
      rule: { columns: { type: true, subject: true } },
    },
    orderBy: [desc(reminders.createdAt)],
  })

  const activeFilter = status && (STATUS_OPTIONS as readonly string[]).includes(status) ? status : 'all'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          {allReminders.length} reminder{allReminders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-slate-500">Status:</span>
        <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 p-1">
          {STATUS_OPTIONS.map((s) => (
            <a
              key={s}
              href={s === 'all' ? '/reminders' : `/reminders?status=${s}`}
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

      {allReminders.length === 0 ? (
        <EmptyState heading="No reminders sent yet" />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Retries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allReminders.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {r.sentAt
                      ? new Date(r.sentAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : r.scheduledFor}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {TYPE_LABEL[r.rule.type] ?? r.rule.type}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/invoices/${r.invoice.id}`}
                      className="font-mono text-sm text-eigensu-blue hover:underline"
                    >
                      {r.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${r.invoice.client.id}`}
                      className="text-slate-900 hover:underline"
                    >
                      {r.invoice.client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-slate-500">
                    {r.recipients.join(', ')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-600">{r.retryCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
