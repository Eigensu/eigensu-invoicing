'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendInvoice, cancelInvoice } from '@/lib/actions/invoices'

interface Props {
  invoiceId: string
  canSend: boolean
  canCancel: boolean
}

export function InvoiceActions({ invoiceId, canSend, canCancel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    startTransition(async () => {
      const result = await sendInvoice(invoiceId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice sent')
      router.refresh()
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelInvoice(invoiceId)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Invoice cancelled')
      router.refresh()
    })
  }

  return (
    <>
      {canSend && (
        <Button size="sm" onClick={handleSend} disabled={isPending}>
          <Send className="h-4 w-4" />
          {isPending ? 'Sending…' : 'Send'}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={handleCancel}
          disabled={isPending}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </>
  )
}
