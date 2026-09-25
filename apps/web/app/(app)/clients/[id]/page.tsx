import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@eigensu/db'
import { clients, projects, invoices } from '@eigensu/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireSession } from '@/lib/auth/session'
import { hasPermission } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EditClientButton } from '@/components/clients/edit-client-button'
import { InvoiceStatusBadge } from '@/components/invoices/invoice-status-badge'
import { formatINR } from '@eigensu/core'
import { ArrowLeft, FolderKanban, FileText } from 'lucide-react'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
    columns: { name: true },
  })
  return { title: client?.name ?? 'Client' }
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const canWrite = hasPermission(session, 'clients:write')

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, id),
    with: {
      projects: {
        with: {
          scheduleItems: { columns: { id: true, status: true } },
        },
        orderBy: [desc(projects.createdAt)],
      },
      invoices: {
        columns: { id: true, invoiceNumber: true, status: true, total: true, issueDate: true, dueDate: true },
        orderBy: [desc(invoices.createdAt)],
      },
    },
  })

  if (!client) notFound()

  const paymentModelLabel: Record<string, string> = {
    one_time: 'One-Time',
    installments: 'Installments',
    subscription: 'Subscription',
    upfront_amc: 'Upfront + AMC',
  }

  const projectStatusVariant = (s: string) =>
    s === 'active' ? 'default' : s === 'completed' ? 'success' : 'secondary'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/records/clients" className="hover:text-slate-900 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />Clients
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
          <Badge variant={client.status === 'active' ? 'success' : 'secondary'}>
            {client.status}
          </Badge>
        </div>
        {canWrite && <EditClientButton client={client} />}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({client.projects.length})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({client.invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info">
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-6">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Contact Person</dt>
                <dd className="mt-1 text-slate-900">{client.contactPerson ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Phone</dt>
                <dd className="mt-1 text-slate-900">{client.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-slate-900">{client.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">GST ID</dt>
                <dd className="mt-1 text-slate-900">{client.gstId ?? '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-medium text-slate-500">Billing Address</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-900">
                  {client.billingAddress ?? '—'}
                </dd>
              </div>
              {client.notes && (
                <div className="col-span-2">
                  <dt className="font-medium text-slate-500">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-slate-900">{client.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </TabsContent>

        {/* Projects tab */}
        <TabsContent value="projects">
          <div className="mt-4 space-y-3">
            {client.projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
                <FolderKanban className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No projects yet.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href={`/projects/new?clientId=${client.id}`}>Create Project</Link>
                </Button>
              </div>
            ) : (
              client.projects.map((project) => {
                const pending = project.scheduleItems.filter((s) => s.status === 'pending').length
                const total = project.scheduleItems.length
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 hover:border-eigensu-blue/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{paymentModelLabel[project.paymentModel] ?? project.paymentModel}</Badge>
                        <span className="text-xs text-slate-500">{pending}/{total} items pending</span>
                      </div>
                    </div>
                    <Badge variant={projectStatusVariant(project.status) as 'default' | 'success' | 'secondary'}>
                      {project.status}
                    </Badge>
                  </Link>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Invoices tab */}
        <TabsContent value="invoices">
          <div className="mt-4 space-y-3">
            {client.invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No invoices yet.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                {client.invoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-eigensu-bg/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-500">Due {inv.dueDate}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-900">{formatINR(Number(inv.total))}</span>
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
