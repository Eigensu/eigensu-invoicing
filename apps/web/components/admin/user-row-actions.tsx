'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUserRole, revokeUser } from '@/lib/actions/admin'
import type { User } from '@eigensu/db'

interface Props {
  user: User
  currentUserId: string
}

export function UserRowActions({ user, currentUserId }: Props) {
  const [revoking, setRevoking] = useState(false)
  const router = useRouter()
  const isSelf = user.id === currentUserId

  async function handleRoleChange(role: string) {
    const result = await updateUserRole(user.id, role as User['role'])
    if (result.success) {
      toast.success(`Role updated to ${role}`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleRevoke() {
    if (!confirm(`Revoke access for ${user.name} (${user.email})? They will no longer be able to sign in.`))
      return
    setRevoking(true)
    try {
      const result = await revokeUser(user.id)
      if (result.success) {
        toast.success(`Access revoked for ${user.name}`)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={user.role}
        onValueChange={handleRoleChange}
        disabled={isSelf}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="viewer">Viewer</SelectItem>
          <SelectItem value="accountant">Accountant</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-red-500 hover:text-red-600"
        onClick={handleRevoke}
        disabled={isSelf || revoking}
        title={isSelf ? 'Cannot revoke your own access' : undefined}
      >
        {revoking ? '…' : 'Revoke'}
      </Button>
    </div>
  )
}
