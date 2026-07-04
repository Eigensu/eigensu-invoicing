import { db } from '@eigensu/db'
import { users } from '@eigensu/db/schema'
import { requireSession } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'
import { InviteUserDialog } from '@/components/admin/invite-user-dialog'
import { UserRowActions } from '@/components/admin/user-row-actions'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Admin — Users' }

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'warning'> = {
  admin: 'default',
  accountant: 'warning',
  viewer: 'secondary',
}

export default async function UsersPage() {
  const session = await requireSession()
  const allUsers = await db.select().from(users).orderBy(users.name)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage who has access to Eigensu Billing and their roles.
          </p>
        </div>
        <InviteUserDialog>
          <Button size="sm">
            <UserPlus className="h-4 w-4" />
            Invite User
          </Button>
        </InviteUserDialog>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {allUsers.map((u) => (
              <TableRow key={u.id} className={u.isActive ? undefined : 'opacity-60'}>
                <TableCell className="font-medium text-slate-900">{u.name}</TableCell>
                <TableCell className="text-slate-600">{u.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={ROLE_VARIANT[u.role] ?? 'secondary'} className="capitalize">
                      {u.role}
                    </Badge>
                    {!u.isActive && <Badge variant="destructive">Revoked</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  {u.isActive && <UserRowActions user={u} currentUserId={session.authUid} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-400">
        Invited users receive an email to set their password. Their role is assigned immediately.
        Self-demotion and self-revocation are blocked.
      </p>
    </div>
  )
}
