import Link from 'next/link'
import { db } from '@eigensu/db'
import { projects, clients } from '@eigensu/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { ProjectTable } from '@/components/projects/project-table'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Projects' }

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; status?: string }>
}) {
  const session = await requireSession()
  const canWrite = hasPermission(session, 'projects:write')
  const { clientId, status } = await searchParams

  const [allProjects, allClients] = await Promise.all([
    db.query.projects.findMany({
      where: and(
        clientId ? eq(projects.clientId, clientId) : undefined,
        status ? eq(projects.status, status as 'active' | 'completed' | 'archived') : eq(projects.status, 'active'),
      ),
      with: {
        client: { columns: { id: true, name: true } },
        scheduleItems: { columns: { id: true, status: true } },
      },
      orderBy: [desc(projects.createdAt)],
    }),
    db.query.clients.findMany({
      where: eq(clients.status, 'active'),
      columns: { id: true, name: true },
      orderBy: [asc(clients.name)],
    }),
  ])

  const statusOptions = ['active', 'completed', 'archived']
  const currentStatus = status ?? 'active'

  function filterHref(key: string, value: string) {
    const params = new URLSearchParams()
    if (key !== 'status') { if (clientId) params.set('clientId', clientId) }
    if (key !== 'clientId') { if (status) params.set('status', status) }
    params.set(key, value)
    return `/projects?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">{allProjects.length} project{allProjects.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Client filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Client:</span>
          <div className="flex gap-1 rounded-md border border-slate-200 p-1">
            <a
              href="/projects"
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${!clientId ? 'bg-white shadow-sm text-eigensu-blue' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All
            </a>
            {allClients.map((c) => (
              <a
                key={c.id}
                href={filterHref('clientId', c.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${clientId === c.id ? 'bg-white shadow-sm text-eigensu-blue' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <div className="flex gap-1 rounded-md border border-slate-200 p-1">
            {statusOptions.map((s) => (
              <a
                key={s}
                href={filterHref('status', s)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors capitalize ${currentStatus === s ? 'bg-white shadow-sm text-eigensu-blue' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>

      <ProjectTable projects={allProjects} />
    </div>
  )
}
