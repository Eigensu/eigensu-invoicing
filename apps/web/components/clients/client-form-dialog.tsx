'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient, updateClient } from '@/lib/actions/clients'
import type { Client } from '@eigensu/db'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Valid email required'),
  billingAddress: z.string().optional(),
  gstId: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client
  onSuccess?: () => void
}

export function ClientFormDialog({ open, onOpenChange, client, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition()
  const isEdit = !!client

  const defaultValues: Partial<FormValues> = client
    ? {
        name: client.name,
        email: client.email,
        ...(client.contactPerson ? { contactPerson: client.contactPerson } : {}),
        ...(client.phone ? { phone: client.phone } : {}),
        ...(client.billingAddress ? { billingAddress: client.billingAddress } : {}),
        ...(client.gstId ? { gstId: client.gstId } : {}),
        ...(client.notes ? { notes: client.notes } : {}),
      }
    : {}

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = isEdit
        ? await updateClient(client.id, values)
        : await createClient(values)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(isEdit ? 'Client updated' : 'Client created')
      reset()
      onOpenChange(false)
      onSuccess?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register('name')} placeholder="Acme Corp" />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" {...register('contactPerson')} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register('phone')} placeholder="+91 98765 XXXXX" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register('email')} placeholder="billing@client.com" />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingAddress">Billing Address</Label>
              <Textarea id="billingAddress" {...register('billingAddress')} rows={2} placeholder="123 Main St, City, State" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gstId">GST ID</Label>
              <Input id="gstId" {...register('gstId')} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register('notes')} rows={2} placeholder="Internal notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-hover text-white">
              {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
