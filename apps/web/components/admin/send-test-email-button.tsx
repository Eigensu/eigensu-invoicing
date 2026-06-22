'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { sendTestEmail } from '@/lib/actions/admin'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

export function SendTestEmailButton() {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      const result = await sendTestEmail()
      if (result.success) {
        toast.success('Test email sent — check your inbox')
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('Failed to send test email')
    } finally {
      setPending(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? 'Sending…' : 'Send Test Email'}
    </Button>
  )
}
