'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Archive } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientFormDialog } from './client-form-dialog'
import { archiveClient } from '@/lib/actions/clients'
import { EmptyState } from '@/components/empty-state'
import type { Client } from '@eigensu/db'

type ClientRow = Client & { projects: { id: string }[] }

interface Props {
  clients: ClientRow[]
  canWrite: boolean
}

export function ClientTable({ clients, canWrite }: Props) {
  const router = useRouter()
  const [editTarget, setEditTarget] = useState<Client | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [archiving, startArchive] = useTransition()

  function handleArchive(id: string, name: string) {
    if (!confirm(`Archive "${name}"? They will be hidden from active lists.`)) return
    startArchive(async () => {
      const result = await archiveClient(id)
      if (!result.success) { toast.error(result.error); return }
      toast.success('Client archived')
      router.refresh()
    })
  }

  if (clients.length === 0) {
    return (
      <>
        <EmptyState
          heading="No clients yet"
          {...(canWrite ? {
            cta: (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                Add client
              </Button>
            ),
          } : {})}
        />
        {showCreate && (
          <ClientFormDialog
            open={showCreate}
            onOpenChange={(o) => { if (!o) setShowCreate(false) }}
            onSuccess={() => { setShowCreate(false); router.refresh() }}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-eigensu-blue hover:underline"
                  >
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-slate-600">{client.contactPerson ?? '—'}</TableCell>
                <TableCell className="text-slate-600">{client.email}</TableCell>
                <TableCell className="text-right text-slate-600">{client.projects.length}</TableCell>
                <TableCell>
                  <Badge variant={client.status === 'active' ? 'success' : 'secondary'}>
                    {client.status}
                  </Badge>
                </TableCell>
                {canWrite && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(client)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {client.status === 'active' && (
                          <DropdownMenuItem
                            onClick={() => handleArchive(client.id, client.name)}
                            disabled={archiving}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archive
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editTarget && (
        <ClientFormDialog
          open
          onOpenChange={(o) => { if (!o) setEditTarget(null) }}
          client={editTarget}
          onSuccess={() => { setEditTarget(null); router.refresh() }}
        />
      )}
    </>
  )
}
