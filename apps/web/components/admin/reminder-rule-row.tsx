'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { upsertReminderRule } from '@/lib/actions/admin'
import type { ReminderRule } from '@eigensu/db'

const FormSchema = z.object({
  offsetDays: z.coerce.number().int(),
  enabled: z.boolean(),
  subject: z.string().min(1, 'Required'),
  bodyTemplate: z.string().min(1, 'Required'),
  ccFounders: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

interface Props {
  rule: ReminderRule
  typeLabel: string
}

export function ReminderRuleRow({ rule, typeLabel }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      offsetDays: rule.offsetDays,
      enabled: rule.enabled,
      subject: rule.subject,
      bodyTemplate: rule.bodyTemplate,
      ccFounders: rule.ccFounders,
    },
  })

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = form
  const enabled = watch('enabled')
  const ccFounders = watch('ccFounders')

  async function onSubmit(values: FormValues) {
    const result = await upsertReminderRule({ id: rule.id, ...values })
    if (result.success) {
      toast.success('Reminder rule updated')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Badge variant="secondary">{typeLabel}</Badge>
      </TableCell>
      <TableCell className="text-slate-600">
        {rule.offsetDays === 0
          ? 'On due date'
          : rule.offsetDays > 0
            ? `+${rule.offsetDays}d after due`
            : `${rule.offsetDays}d before due`}
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-slate-600">{rule.subject}</TableCell>
      <TableCell>
        {rule.ccFounders ? (
          <Badge variant="default" className="text-xs">Yes</Badge>
        ) : (
          <span className="text-xs text-slate-400">No</span>
        )}
      </TableCell>
      <TableCell>
        {rule.enabled ? (
          <Badge variant="success" className="text-xs">Enabled</Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">Disabled</Badge>
        )}
      </TableCell>
      <TableCell>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Reminder Rule — {typeLabel}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Offset Days</Label>
                  <Input {...register('offsetDays')} type="number" />
                  <p className="text-xs text-slate-400">
                    0 = on due date, negative = before, positive = after
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input {...register('subject')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email Body Template</Label>
                <textarea
                  {...register('bodyTemplate')}
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-eigensu-blue focus:outline-none focus:ring-1 focus:ring-eigensu-blue"
                  rows={6}
                />
                <p className="text-xs text-slate-400">
                  Supports HTML. Variables: {'{{clientName}}'}, {'{{invoiceNumber}}'},{' '}
                  {'{{amount}}'}, {'{{outstanding}}'}, {'{{dueDate}}'}, {'{{daysOverdue}}'}.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ccFounders"
                    checked={ccFounders}
                    onCheckedChange={(v) => setValue('ccFounders', v)}
                  />
                  <Label htmlFor="ccFounders" className="text-sm font-normal">CC founders</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={(v) => setValue('enabled', v)}
                  />
                  <Label htmlFor="enabled" className="text-sm font-normal">Enabled</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save Rule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  )
}
