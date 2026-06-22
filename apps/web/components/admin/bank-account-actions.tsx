'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BankAccountDialog } from './bank-account-dialog'
import { setDefaultBankAccount, deleteBankAccount } from '@/lib/actions/admin'
import type { BankAccount } from '@eigensu/db'

interface Props {
  account: BankAccount
}

export function BankAccountActions({ account }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const router = useRouter()

  async function handleSetDefault() {
    setSettingDefault(true)
    try {
      const result = await setDefaultBankAccount(account.id)
      if (result.success) {
        toast.success('Default account updated')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setSettingDefault(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${account.label}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const result = await deleteBankAccount(account.id)
      if (result.success) {
        toast.success('Bank account deleted')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <BankAccountDialog account={account}>
        <Button variant="ghost" size="sm" className="text-xs">
          Edit
        </Button>
      </BankAccountDialog>
      {!account.isDefault && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={handleSetDefault}
          disabled={settingDefault}
        >
          {settingDefault ? '…' : 'Set Default'}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-red-500 hover:text-red-600"
        onClick={handleDelete}
        disabled={deleting}
      >
        {deleting ? '…' : 'Delete'}
      </Button>
    </div>
  )
}
