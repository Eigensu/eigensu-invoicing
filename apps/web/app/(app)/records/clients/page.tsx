import { db } from '@eigensu/db'
import { clients } from '@eigensu/db/schema'
import { ilike, eq, and, asc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { ClientTable } from '@/components/clients/client-table'
import { CreateClientButton } from '@/components/clients/create-client-button'
import { ClientFilters } from '@/components/clients/client-filters'

export const metadata = { title: 'Records — Clients' }

export default async function RecordsClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const session = await requireSession()
  const canWrite = hasPermission(session, 'clients:write')
  const { q, status } = await searchParams
  const showArchived = status === 'archived'

  const allClients = await db.query.clients.findMany({
    where: and(
      q ? ilike(clients.name, `%${q}%`) : undefined,
      showArchived ? eq(clients.status, 'archived') : eq(clients.status, 'active'),
    ),
    with: { projects: { columns: { id: true } } },
    orderBy: [asc(clients.name)],
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal-600">
          {showArchived
            ? 'Archived clients'
            : `${allClients.length} active client${allClients.length !== 1 ? 's' : ''}`}
        </p>
        {canWrite && <CreateClientButton />}
      </div>

      <ClientFilters
        basePath="/records/clients"
        {...(q ? { q } : {})}
        {...(status ? { status } : {})}
      />

      <ClientTable clients={allClients} canWrite={canWrite} />
    </div>
  )
}
