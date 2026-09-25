import { redirect } from 'next/navigation'
import { db } from '@eigensu/db'
import { clients, bankAccounts, settings } from '@eigensu/db/schema'
import { eq, asc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { EngagementWizard } from '@/components/engagements/engagement-wizard'

export const metadata = { title: 'New Engagement' }

export default async function NewEngagementPage() {
  const session = await requireSession()
  if (!hasPermission(session, 'projects:write')) redirect('/records/projects')

  const [activeClients, allBankAccounts, settingsRow] = await Promise.all([
    db.query.clients.findMany({
      where: eq(clients.status, 'active'),
      columns: { id: true, name: true },
      orderBy: [asc(clients.name)],
    }),
    db.query.bankAccounts.findMany({ orderBy: [asc(bankAccounts.label)] }),
    db
      .select()
      .from(settings)
      .limit(1)
      .then((r) => r[0] ?? null),
  ])

  if (allBankAccounts.length === 0) redirect('/admin/bank-accounts')

  const defaultBank = allBankAccounts.find((b) => b.isDefault) ?? allBankAccounts[0]
  const today = new Date().toISOString().split('T')[0] as string
  const dueDays = settingsRow?.defaultDueDays ?? 30
  const defaultDueDate = new Date(Date.now() + dueDays * 86_400_000).toISOString().split('T')[0] as string

  return (
    <EngagementWizard
      clients={activeClients}
      bankAccounts={allBankAccounts.map((b) => ({
        id: b.id,
        label: b.label,
        isDefault: b.isDefault ?? false,
      }))}
      defaultBankAccountId={defaultBank?.id ?? ''}
      defaultTaxPercent={Number(settingsRow?.defaultTaxPercent ?? 0)}
      defaultIssueDate={today}
      defaultDueDate={defaultDueDate}
    />
  )
}
