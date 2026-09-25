'use client'

import Link from 'next/link'
import { formatINR } from '@eigensu/core'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import type { Project, Client, ScheduleItem } from '@eigensu/db'

type ProjectRow = Project & {
  client: Pick<Client, 'id' | 'name'>
  scheduleItems: Pick<ScheduleItem, 'id' | 'status'>[]
}

const MODEL_LABEL: Record<string, string> = {
  one_time: 'One-Time',
  installments: 'Installments',
  subscription: 'Subscription',
  upfront_amc: 'Upfront + AMC',
}

interface Props {
  projects: ProjectRow[]
}

export function ProjectTable({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center">
        <p className="text-sm text-slate-500">No projects found.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const pending = project.scheduleItems.filter((s) => s.status === 'pending').length
            return (
              <TableRow key={project.id}>
                <TableCell>
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium text-eigensu-blue hover:underline"
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${project.client.id}`} className="text-slate-600 hover:underline">
                    {project.client.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {MODEL_LABEL[project.paymentModel] ?? project.paymentModel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-slate-900">
                  {formatINR(Number(project.totalValue))}
                </TableCell>
                <TableCell className="text-right text-slate-600">{pending}</TableCell>
                <TableCell>
                  <ProjectStatusBadge status={project.status} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
