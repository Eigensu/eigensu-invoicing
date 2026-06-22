import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@eigensu/db'
import { projects, scheduleItems } from '@eigensu/db/schema'
import { eq, asc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { ScheduleTable } from '@/components/projects/schedule-table'
import { EditProjectButton } from '@/components/projects/edit-project-button'
import { formatINR } from '@eigensu/core'
import { ArrowLeft } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    columns: { name: true },
  })
  return { title: project?.name ?? 'Project' }
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const canWrite = hasPermission(session, 'projects:write')

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      client: { columns: { id: true, name: true } },
      scheduleItems: {
        with: {
          invoiceLinks: {
            with: {
              invoice: { columns: { id: true, invoiceNumber: true, status: true } },
            },
          },
        },
        orderBy: [asc(scheduleItems.dueDate)],
      },
    },
  })

  if (!project) notFound()

  const MODEL_LABEL: Record<string, string> = {
    one_time: 'One-Time',
    installments: 'Installments',
    subscription: 'Subscription',
    upfront_amc: 'Upfront + AMC',
  }

  const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
    active: 'default',
    completed: 'success',
    archived: 'secondary',
  }

  const pendingCount = project.scheduleItems.filter((s) => s.status === 'pending').length
  const paidCount = project.scheduleItems.filter((s) => s.status === 'paid').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/projects" className="hover:text-slate-900 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />Projects
            </Link>
            <span>/</span>
            <Link href={`/clients/${project.client.id}`} className="hover:text-slate-900">
              {project.client.name}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[project.status] ?? 'secondary'}>{project.status}</Badge>
            <Badge variant="secondary">{MODEL_LABEL[project.paymentModel] ?? project.paymentModel}</Badge>
          </div>
        </div>
        {canWrite && <EditProjectButton project={project} />}
      </div>

      {/* Info card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm md:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-500">Client</dt>
            <dd className="mt-1">
              <Link href={`/clients/${project.client.id}`} className="text-eigensu-blue hover:underline">
                {project.client.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Total Value</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatINR(Number(project.totalValue))}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Start Date</dt>
            <dd className="mt-1 text-slate-900">{project.startDate}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">End Date</dt>
            <dd className="mt-1 text-slate-900">{project.endDate ?? '—'}</dd>
          </div>
          {project.amcAmount && (
            <div>
              <dt className="font-medium text-slate-500">AMC Amount</dt>
              <dd className="mt-1 text-slate-900">{formatINR(Number(project.amcAmount))}</dd>
            </div>
          )}
          {project.amcRecurrence && (
            <div>
              <dt className="font-medium text-slate-500">AMC Recurrence</dt>
              <dd className="mt-1 capitalize text-slate-900">{project.amcRecurrence}</dd>
            </div>
          )}
          {project.description && (
            <div className="col-span-2">
              <dt className="font-medium text-slate-500">Description</dt>
              <dd className="mt-1 text-slate-900">{project.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Schedule table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Payment Schedule</h2>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{pendingCount} pending</span>
            <span>·</span>
            <span>{paidCount} paid</span>
            <span>·</span>
            <span>{project.scheduleItems.length} total</span>
          </div>
        </div>
        <ScheduleTable
          projectId={project.id}
          clientId={project.client.id}
          items={project.scheduleItems}
        />
      </div>
    </div>
  )
}
