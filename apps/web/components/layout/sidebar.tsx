'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CreditCard,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/actions/auth'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard',  href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients',    href: '/clients',   icon: Users },
  { label: 'Projects',   href: '/projects',  icon: FolderKanban },
  { label: 'Invoices',   href: '/invoices',  icon: FileText },
  { label: 'Payments',   href: '/payments',  icon: CreditCard },
  { label: 'Reminders',  href: '/reminders', icon: Bell },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Admin', href: '/admin', icon: Settings },
]

interface SidebarProps {
  role: 'admin' | 'accountant' | 'viewer'
  name: string
  email: string
}

function avatarInitials(name: string, email: string): string {
  const trimmed = name.trim()
  if (trimmed) {
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
    }
    return trimmed.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg mx-2 px-4 py-2.5 text-sm transition-all duration-150',
        active
          ? 'bg-[rgba(78,165,217,0.12)] text-white'
          : 'text-[#9B9EA8] hover:bg-white/[0.06] hover:text-[#E8E0D6]',
      )}
    >
      {/* Left accent bar on active */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sky" />
      )}
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 stroke-[1.75]',
          active ? 'text-sky' : 'text-[#9B9EA8] group-hover:text-[#E8E0D6]',
        )}
      />
      <span className="font-medium">{item.label}</span>
    </Link>
  )
}

export function Sidebar({ role, name, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
      router.push('/login')
    })
  }

  const initials = avatarInitials(name, email)
  const displayName = name.trim() || email

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col bg-charcoal">

      {/* Brand header */}
      <div className="flex h-[72px] items-center gap-3 px-6 border-b border-white/[0.08]">
        <div className="flex flex-col leading-none">
          <span className="font-sans text-[17px] font-bold tracking-[0.12em] text-white uppercase">
            EIGENSU
          </span>
          <span className="font-sans text-[10px] font-medium tracking-[0.2em] text-sky uppercase mt-0.5">
            BILLING
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        <p className="px-6 pt-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-charcoal-400">
          Main
        </p>
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Admin section */}
        {role === 'admin' && (
          <>
            <div className="mx-4 my-3 border-t border-white/[0.08]" />
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white text-xs font-semibold uppercase">
            {initials}
          </div>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white leading-tight">
              {displayName}
            </p>
            {name.trim() && (
              <p className="truncate text-xs text-charcoal-400 leading-tight mt-0.5">
                {email}
              </p>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            disabled={pending}
            aria-label="Sign out"
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-charcoal-400 transition-colors hover:text-[#E8E0D6] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
