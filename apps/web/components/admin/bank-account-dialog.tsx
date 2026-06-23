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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { upsertBankAccount } from '@/lib/actions/admin'
import type { BankAccount } from '@eigensu/db'

const FormSchema = z.object({
  holderName: z.string().min(1, 'Required'),
  accountNumber: z.string().min(1, 'Required'),
  ifsc: z.string().length(11, 'IFSC must be exactly 11 characters'),
  upiId: z.string(),
  label: z.string().min(1, 'Required'),
  isDefault: z.boolean(),
})

type FormValues = z.infer<typeof FormSchema>

interface Props {
  children: React.ReactNode
  account?: BankAccount
}

export function BankAccountDialog({ children, account }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      holderName: account?.holderName ?? '',
      accountNumber: account?.accountNumber ?? '',
      ifsc: account?.ifsc ?? '',
      upiId: account?.upiId ?? '',
      label: account?.label ?? '',
      isDefault: account?.isDefault ?? false,
    },
  })

  const { register, handleSubmit, formState: { isSubmitting, errors } } = form

  async function onSubmit(values: FormValues) {
    const result = await upsertBankAccount({
      ...(account ? { id: account.id } : {}),
      holderName: values.holderName,
      accountNumber: values.accountNumber,
      ifsc: values.ifsc,
      ...(values.upiId ? { upiId: values.upiId } : {}),
      label: values.label,
      isDefault: values.isDefault,
    })

    if (result.success) {
      toast.success(account ? 'Bank account updated' : 'Bank account added')
      setOpen(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Label</Label>
                <Input {...register('label')} placeholder="Primary Account" />
                {errors.label && <p className="text-xs text-red-500">{errors.label.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Account Holder</Label>
                <Input {...register('holderName')} placeholder="Account holder name" />
                {errors.holderName && (
                  <p className="text-xs text-red-500">{errors.holderName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input {...register('accountNumber')} placeholder="Account number" />
                {errors.accountNumber && (
                  <p className="text-xs text-red-500">{errors.accountNumber.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>IFSC Code</Label>
                <Input {...register('ifsc')} placeholder="SBIN0001234" maxLength={11} />
                {errors.ifsc && <p className="text-xs text-red-500">{errors.ifsc.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>UPI ID (optional)</Label>
                <Input {...register('upiId')} placeholder="yourname@bankname" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" {...register('isDefault')} className="rounded" />
              <Label htmlFor="isDefault" className="text-sm font-normal">
                Set as default account
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-navy hover:bg-navy-hover text-white">
              {isSubmitting ? 'Saving…' : account ? 'Update' : 'Add Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
