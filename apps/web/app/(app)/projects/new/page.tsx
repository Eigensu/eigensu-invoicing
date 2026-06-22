import { db } from '@eigensu/db'
import { clients } from '@eigensu/db/schema'
import { eq, asc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { ProjectWizard } from '@/components/projects/project-wizard'

export const metadata = { title: 'New Project' }

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const session = await requireSession()
  if (!hasPermission(session, 'projects:write')) redirect('/projects')

  const { clientId } = await searchParams

  const activeClients = await db.query.clients.findMany({
    where: eq(clients.status, 'active'),
    columns: { id: true, name: true },
    orderBy: [asc(clients.name)],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Project</h1>
        <p className="mt-1 text-sm text-slate-500">Create a project and generate a payment schedule.</p>
      </div>
      <ProjectWizard clients={activeClients} {...(clientId ? { defaultClientId: clientId } : {})} />
    </div>
  )
}
