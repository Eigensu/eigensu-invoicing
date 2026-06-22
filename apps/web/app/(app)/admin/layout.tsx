import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { isAdmin } from '@/lib/auth/roles'
import { AdminNav } from '@/components/admin/admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  if (!isAdmin(session)) redirect('/dashboard')

  return (
    <div className="space-y-6">
      {/* Floating centered pill nav */}
      <div className="flex justify-center">
        <AdminNav />
      </div>

      <div>{children}</div>
    </div>
  )
}
