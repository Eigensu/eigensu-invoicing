import Link from 'next/link'
import { db } from '@eigensu/db'
import { invoices } from '@eigensu/db/schema'
import { notInArray } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { formatINR } from '@eigensu/core'
import { getTodayIST, dateToISO } from '@/lib/automation/today-ist'
import { endOfMonth, subMonths, format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { MonthlyChart } from '@/components/dashboard/monthly-chart'
import { ClientOutstandingChart } from '@/components/dashboard/client-outstanding-chart'
import { SendReminderButton } from '@/components/dashboard/send-reminder-button'
import type { MonthlyDataPoint } from '@/components/dashboard/monthly-chart'
import type { ClientOutstandingPoint } from '@/components/dashboard/client-outstanding-chart'
import { TrendingUp, DollarSign, AlertCircle, Clock } from 'lucide-react'

export const metadata = { title: 'Dashboard' }

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

export default async function DashboardPage() {
  const session = await requireSession()
  const canWrite = hasPermission(session, 'invoices:write')

  // Single query: all non-cancelled invoices with client + payments
  const allInvoices = await db.query.invoices.findMany({
    where: notInArray(invoices.status, ['cancelled']),
    with: {
      client: { columns: { id: true, name: true } },
      payments: { columns: { amount: true, dateReceived: true } },
    },
    columns: {
      id: true,
      invoiceNumber: true,
      total: true,
      status: true,
      dueDate: true,
      issueDate: true,
    },
  })

  // ── Summary cards ──────────────────────────────────────────────────────────
  // Gap A3 fix: outstanding = net-of-payments per invoice, NOT gross totals.
  // totalBilled includes drafts (committed billing even if unsent).
  let totalBilled = 0
  let totalReceived = 0
  let outstanding = 0
  let overdueOutstanding = 0

  for (const inv of allInvoices) {
    const total = Number(inv.total)
    totalBilled += total
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
    totalReceived += paid
    if (inv.status !== 'paid') {
      const rem = total - paid
      outstanding += rem
      if (inv.status === 'overdue') overdueOutstanding += rem
    }
  }

  // ── Monthly chart — last 12 months ────────────────────────────────────────
  const todayIST = getTodayIST()
  const todayStr = dateToISO(todayIST)
  const endOfMonthStr = dateToISO(endOfMonth(todayIST))
  const todayDate = parseISO(todayStr)

  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    months.push(format(subMonths(todayIST, i), 'MMM yyyy'))
  }

  const monthlyBilled = new Map<string, number>()
  const monthlyReceived = new Map<string, number>()
  for (const m of months) {
    monthlyBilled.set(m, 0)
    monthlyReceived.set(m, 0)
  }

  for (const inv of allInvoices) {
    const m = format(parseISO(inv.issueDate), 'MMM yyyy')
    const prev = monthlyBilled.get(m)
    if (prev !== undefined) monthlyBilled.set(m, prev + Number(inv.total))
    for (const p of inv.payments) {
      const pm = format(parseISO(p.dateReceived), 'MMM yyyy')
      const prevR = monthlyReceived.get(pm)
      if (prevR !== undefined) monthlyReceived.set(pm, prevR + Number(p.amount))
    }
  }

  const monthlyData: MonthlyDataPoint[] = months.map((m) => ({
    month: m,
    billed: monthlyBilled.get(m) ?? 0,
    received: monthlyReceived.get(m) ?? 0,
  }))

  // ── Outstanding by client ──────────────────────────────────────────────────
  // Gap A3 fix: net outstanding (not gross per-client total).
  const clientMap = new Map<string, { name: string; outstanding: number }>()
  for (const inv of allInvoices) {
    if (inv.status === 'paid') continue
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
    const rem = Number(inv.total) - paid
    if (rem <= 0) continue
    const existing = clientMap.get(inv.client.id)
    if (existing) {
      existing.outstanding += rem
    } else {
      clientMap.set(inv.client.id, { name: inv.client.name, outstanding: rem })
    }
  }

  const clientData: ClientOutstandingPoint[] = [...clientMap.values()]
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8)
    .map((c) => ({ client: c.name, outstanding: c.outstanding }))

  // ── Due this month ─────────────────────────────────────────────────────────
  const dueThisMonth = allInvoices
    .filter(
      (inv) =>
        inv.dueDate >= todayStr &&
        inv.dueDate <= endOfMonthStr &&
        inv.status !== 'paid',
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // ── Overdue list ───────────────────────────────────────────────────────────
  // Gap A3 fix: outstanding = total - payments_received (not gross total).
  const overdueList = allInvoices
    .filter((inv) => inv.status === 'overdue')
    .map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
      const invOutstanding = Number(inv.total) - paid
      const daysOverdue = Math.max(
        0,
        differenceInCalendarDays(todayDate, parseISO(inv.dueDate)),
      )
      return { ...inv, invOutstanding, daysOverdue }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {format(todayIST, 'MMMM d, yyyy')} · IST
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Total Billed"
          value={formatINR(totalBilled)}
          icon={TrendingUp}
          iconClass="text-blue-500"
          empty={totalBilled === 0}
        />
        <SummaryCard
          label="Total Received"
          value={formatINR(totalReceived)}
          icon={DollarSign}
          iconClass="text-emerald-500"
          empty={totalReceived === 0}
        />
        <SummaryCard
          label="Outstanding"
          value={formatINR(outstanding)}
          icon={Clock}
          iconClass="text-amber-500"
          empty={outstanding === 0}
          emptyLabel="All clear"
        />
        <SummaryCard
          label="Overdue"
          value={formatINR(overdueOutstanding)}
          icon={AlertCircle}
          iconClass={overdueOutstanding > 0 ? 'text-red-500' : 'text-slate-400'}
          empty={overdueOutstanding === 0}
          emptyLabel="None overdue"
          {...(overdueOutstanding > 0 ? { valueClass: 'text-red-600' } : {})}
        />
      </div>

      {/* Monthly billed vs received chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">
          Monthly Billing vs Payments — Last 12 Months
        </h2>
        <MonthlyChart data={monthlyData} />
      </div>

      {/* Outstanding by client */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Outstanding by Client</h2>
        <ClientOutstandingChart data={clientData} />
      </div>

      {/* Due this month + Overdue side by side on large screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Due this month */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Due This Month
              {dueThisMonth.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {dueThisMonth.length}
                </span>
              )}
            </h2>
          </div>
          {dueThisMonth.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-500">No invoices due this month.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Invoice</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Client</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Due</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Amount</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {dueThisMonth.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-mono text-xs text-eigensu-blue hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${inv.client.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {inv.client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{inv.dueDate}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatINR(Number(inv.total))}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'secondary'}>
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Overdue */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Overdue
              {overdueList.length > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {overdueList.length}
                </span>
              )}
            </h2>
          </div>
          {overdueList.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-slate-500">No overdue invoices. Great work!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 font-medium text-slate-500">Invoice</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Client</th>
                  <th className="px-5 py-3 font-medium text-slate-500">Days</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-500">Outstanding</th>
                  {canWrite && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody>
                {overdueList.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-mono text-xs text-eigensu-blue hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${inv.client.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {inv.client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        {inv.daysOverdue}d
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-red-600">
                      {formatINR(inv.invOutstanding)}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        <SendReminderButton invoiceId={inv.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: string
  icon: React.ElementType
  iconClass: string
  empty: boolean
  emptyLabel?: string
  valueClass?: string
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClass,
  empty,
  emptyLabel,
  valueClass,
}: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueClass ?? 'text-slate-900'}`}>
        {empty ? (emptyLabel ?? '₹0') : value}
      </p>
    </div>
  )
}
