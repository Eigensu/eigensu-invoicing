import { requireSession } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const role = (session.user.role ?? 'viewer') as 'admin' | 'accountant' | 'viewer'

  return (
    <div className="flex h-screen overflow-hidden bg-cream-light">
      <Sidebar
        role={role}
        name={session.user.name ?? ''}
        email={session.user.email ?? ''}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
