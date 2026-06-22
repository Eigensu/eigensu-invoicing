'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientFormDialog } from './client-form-dialog'
import type { Client } from '@eigensu/db'

export function EditClientButton({ client }: { client: Client }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Edit
      </Button>
      <ClientFormDialog
        open={open}
        onOpenChange={setOpen}
        client={client}
        onSuccess={() => router.refresh()}
      />
    </>
  )
}
