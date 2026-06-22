'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateProject } from '@/lib/actions/projects'
import type { Project } from '@eigensu/db'

// Only the fields that are safe to edit post-creation
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  endDate: z.string().date().optional().or(z.literal('')),
  amcAmount: z.string().optional(),
  amcRecurrence: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}

export function ProjectEditDialog({ open, onOpenChange, project }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isAmcProject = project.paymentModel === 'upfront_amc' || project.paymentModel === 'subscription'

  const defaultValues: Partial<FormValues> = {
    name: project.name,
    ...(project.description ? { description: project.description } : {}),
    ...(project.endDate ? { endDate: project.endDate } : {}),
    ...(project.amcAmount ? { amcAmount: project.amcAmount } : {}),
    ...(project.amcRecurrence && project.amcRecurrence !== 'none'
      ? { amcRecurrence: project.amcRecurrence }
      : {}),
  }

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const amcRecurrence = watch('amcRecurrence')

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload: Record<string, string | undefined> = {
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
        ...(values.endDate ? { endDate: values.endDate } : {}),
        ...(isAmcProject && values.amcAmount ? { amcAmount: values.amcAmount } : {}),
        ...(isAmcProject && values.amcRecurrence ? { amcRecurrence: values.amcRecurrence } : {}),
      }
      const result = await updateProject(project.id, payload)
      if (!result.success) { toast.error(result.error); return }
      toast.success('Project updated')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} rows={2} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
            </div>

            {isAmcProject && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="amcAmount">AMC Amount per Period (₹)</Label>
                  <Input id="amcAmount" type="number" min="1" step="1" {...register('amcAmount')} />
                </div>
                <div className="space-y-1.5">
                  <Label>AMC Recurrence</Label>
                  <Select
                    value={amcRecurrence ?? ''}
                    onValueChange={(v) => setValue('amcRecurrence', v as 'monthly' | 'quarterly' | 'yearly')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-hover text-white">
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
