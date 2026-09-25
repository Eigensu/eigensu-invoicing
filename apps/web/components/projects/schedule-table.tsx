'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatINR } from '@eigensu/core'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { FileText } from 'lucide-react'
import type { ScheduleItem } from '@eigensu/db'

type ScheduleItemWithInvoice = ScheduleItem & {
  invoiceLinks: {
    invoice: { id: string; invoiceNumber: string; status: string } | null
  }[]
}

const TYPE_LABEL: Record<string, string> = {
  one_time: 'One-Time',
  installment: 'Installment',
  amc: 'AMC',
  subscription: 'Subscription',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  pending: 'warning',
  paid: 'success',
  partial: 'default',
  overdue: 'destructive',
  cancelled: 'secondary',
}

interface Props {
  projectId: string
  clientId: string
  items: ScheduleItemWithInvoice[]
}

export function ScheduleTable({ projectId, clientId, items }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const pendingItems = items.filter((i) => i.status === 'pending')
  const allPendingSelected = pendingItems.length > 0 && pendingItems.every((i) => selected.has(i.id))

  function toggleAll() {
    if (allPendingSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingItems.map((i) => i.id)))
    }
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const generateHref = () => {
    const ids = [...selected].join(',')
    return `/invoices/new?scheduleItems=${ids}&clientId=${clientId}&projectId=${projectId}`
  }

  if (items.length === 0) {
    return <EmptyState heading="No schedule items." />
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-eigensu-bg border border-eigensu-blue/20 px-4 py-2.5">
          <span className="text-sm text-slate-700">
            {selected.size} item{selected.size !== 1 ? 's' : ''} selected
          </span>
          <Button asChild size="sm">
            <Link href={generateHref()}>
              <FileText className="h-4 w-4" />
              Generate Invoice
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-slate-500"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                {pendingItems.length > 0 && (
                  <Checkbox
                    checked={allPendingSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all pending"
                  />
                )}
              </TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const link = item.invoiceLinks[0]
              const invoice = link?.invoice ?? null
              const canSelect = item.status === 'pending' && invoice === null

              return (
                <TableRow key={item.id} data-state={selected.has(item.id) ? 'selected' : undefined}>
                  <TableCell>
                    {canSelect && (
                      <Checkbox
                        checked={selected.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                        aria-label={`Select ${item.label}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{item.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABEL[item.type] ?? item.type}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{item.dueDate}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(Number(item.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invoice ? (
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-xs text-eigensu-blue font-mono hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
