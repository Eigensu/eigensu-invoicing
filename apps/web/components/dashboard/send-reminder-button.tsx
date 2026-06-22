'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sendInvoice } from '@/lib/actions/invoices'
import { toast } from 'sonner'
import { Mail } from 'lucide-react'

export function SendReminderButton({ invoiceId }: { invoiceId: string }) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      const result = await sendInvoice(invoiceId)
      if (result.success) {
        toast.success('Reminder sent')
      } else {
        toast.error(result.error ?? 'Failed to send reminder')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="h-7 gap-1 px-2 text-xs text-eigensu-blue hover:bg-eigensu-bg hover:text-eigensu-blue"
    >
      <Mail className="h-3 w-3" />
      {pending ? 'Sending…' : 'Send Reminder'}
    </Button>
  )
}
