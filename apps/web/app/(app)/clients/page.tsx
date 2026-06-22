import { db } from '@eigensu/db'
import { clients } from '@eigensu/db/schema'
import { ilike, eq, and, asc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { ClientTable } from '@/components/clients/client-table'
import { CreateClientButton } from '@/components/clients/create-client-button'
import { ClientFilters } from '@/components/clients/client-filters'

export const metadata = { title: 'Clients' }

export default async function ClientsPage({
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            {showArchived
              ? 'Archived clients'
              : `${allClients.length} active client${allClients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canWrite && <CreateClientButton />}
      </div>

      <ClientFilters {...(q ? { q } : {})} {...(status ? { status } : {})} />

      <ClientTable clients={allClients} canWrite={canWrite} />
    </div>
  )
}
