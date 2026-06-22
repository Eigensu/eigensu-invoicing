import { redirect } from 'next/navigation'
import { db } from '@eigensu/db'
import { scheduleItems, bankAccounts, clients, settings } from '@eigensu/db/schema'
import { eq, asc, inArray } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { InvoiceForm } from '@/components/invoices/invoice-form'

export const metadata = { title: 'New Invoice' }

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{
    scheduleItems?: string
    clientId?: string
    projectId?: string
  }>
}) {
  const session = await requireSession()
  if (!hasPermission(session, 'invoices:write')) redirect('/invoices')

  const {
    scheduleItems: scheduleItemParam,
    clientId: preselectedClientId,
    projectId: preselectedProjectId,
  } = await searchParams

  const scheduleItemIds = scheduleItemParam
    ? scheduleItemParam.split(',').filter(Boolean)
    : []

  const [preloadedScheduleItems, allBankAccounts, allClients, settingsRow] = await Promise.all([
    scheduleItemIds.length > 0
      ? db.query.scheduleItems.findMany({
          where: inArray(scheduleItems.id, scheduleItemIds),
          with: {
            project: {
              columns: { id: true, name: true, clientId: true },
            },
          },
        })
      : Promise.resolve([]),
    db.query.bankAccounts.findMany({ orderBy: [asc(bankAccounts.label)] }),
    db.query.clients.findMany({
      where: eq(clients.status, 'active'),
      columns: { id: true, name: true },
      orderBy: [asc(clients.name)],
    }),
    db
      .select()
      .from(settings)
      .limit(1)
      .then((r) => r[0] ?? null),
  ])

  if (allBankAccounts.length === 0) redirect('/invoices')

  const defaultBankAccount = allBankAccounts.find((b) => b.isDefault) ?? allBankAccounts[0]

  const today = new Date().toISOString().split('T')[0] as string
  const dueDays = settingsRow?.defaultDueDays ?? 30
  const dueDate = new Date(Date.now() + dueDays * 86_400_000).toISOString().split('T')[0] as string

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">New Invoice</h1>
      <InvoiceForm
        preloadedScheduleItems={preloadedScheduleItems.map((si) => ({
          id: si.id,
          label: si.label,
          amount: Number(si.amount),
          clientId: si.project.clientId,
        }))}
        {...(preselectedClientId !== undefined ? { preselectedClientId } : {})}
        {...(preselectedProjectId !== undefined ? { preselectedProjectId } : {})}
        clients={allClients}
        bankAccounts={allBankAccounts}
        defaultBankAccountId={defaultBankAccount?.id ?? ''}
        defaultTaxPercent={Number(settingsRow?.defaultTaxPercent ?? 0)}
        defaultIssueDate={today}
        defaultDueDate={dueDate}
      />
    </div>
  )
}
