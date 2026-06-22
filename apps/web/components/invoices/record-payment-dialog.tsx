'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { recordPayment } from '@/lib/actions/payments'
import { formatINR } from '@eigensu/core'

interface Props {
  invoiceId: string
  outstanding: number
}

type PaymentMode = 'bank' | 'upi' | 'cash' | 'other'

export function RecordPaymentDialog({ invoiceId, outstanding }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0] as string

  const [amount, setAmount] = useState(String(outstanding))
  const [dateReceived, setDateReceived] = useState(today)
  const [mode, setMode] = useState<PaymentMode>('bank')
  const [reference, setReference] = useState('')

  function handleOpenChange(next: boolean) {
    if (!isPending) setOpen(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = parseInt(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    startTransition(async () => {
      const result = await recordPayment({
        invoiceId,
        amount: parsedAmount,
        dateReceived,
        mode,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Payment recorded')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record Payment
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto space-y-4 px-6 py-5">
              <p className="text-sm text-charcoal-600">
                Outstanding: <span className="font-medium text-charcoal">{formatINR(outstanding)}</span>
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">Amount (₹)</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="1"
                  max={outstanding}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Date Received</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-mode">Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                  <SelectTrigger id="pay-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-reference">Reference (optional)</Label>
                <Input
                  id="pay-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="UTR / transaction ID"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-navy hover:bg-navy-hover text-white">
                {isPending ? 'Saving…' : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
